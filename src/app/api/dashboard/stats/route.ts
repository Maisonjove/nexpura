/**
 * GET /api/dashboard/stats — Route Handler fast path for dashboard stats.
 *
 * Option C, dashboard cold-load reduction. The server-action
 * `getDashboardStats` also runs through `readPrecomputedStats`, but it
 * ships behind the full RSC auth/action pipeline. This handler is a
 * thinner, Route-Handler-shaped twin of the same logic — SWR on the
 * client calls it directly and skips the action-serialization overhead.
 *
 * Originally this was `runtime = "edge"` for always-warm first-paint,
 * but Next 16 `cacheComponents` is incompatible with per-route
 * `runtime` exports, so it's a plain Node Route Handler. Fluid compute
 * shares the Node container across routes, so the keep-warm cron on
 * /api/dashboard/warm still keeps this lambda hot.
 *
 * Behavior:
 *   - Reads the `tenant_dashboard_stats` precomputed aggregate row for
 *     the caller's tenant.
 *   - Reads today's tasks (per-user filter applied for non-managers).
 *   - Hydrates into the canonical `DashboardStatsData` shape via the
 *     shared helper (same shape the server-action path returns).
 *   - Returns `{ stale: true, reason }` with HTTP 200 when the fast
 *     path can't serve (precomputed row missing/stale, location filter
 *     active). The SWR fetcher then falls through to the server-action
 *     live-compute path.
 *
 * Auth:
 *   - Session cookie via `@supabase/ssr`.
 *   - 401 if no session. No bearer/JWT shortcut — middleware strips
 *     forged x-auth-* headers on every inbound request.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  hydrateDashboardStats,
  mergeRecentActivityFallback,
  type PrecomputedRow,
  type LiveTaskRow,
} from "@/app/(app)/dashboard/_stats-hydrate";

const PRECOMPUTED_MAX_STALE_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => {
          // Read-only route — don't write back mutation cookies.
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userRow } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  const tenantId = (userRow as { tenant_id?: string; role?: string } | null)?.tenant_id;
  const role = (userRow as { tenant_id?: string; role?: string } | null)?.role ?? "staff";
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });
  const isManager = role === "owner" || role === "manager";

  // Fast path only handles the tenant-wide precomputed case. Per-location
  // filtered reads go through the heavier live path in the server action.
  const locationIdsParam = req.nextUrl.searchParams.get("locationIds");
  const hasLocationFilter =
    !!locationIdsParam &&
    locationIdsParam !== "all" &&
    locationIdsParam.split(",").filter(Boolean).length > 0;
  if (hasLocationFilter) {
    return NextResponse.json({ stale: true, reason: "location_filter" });
  }

  const { data: row, error } = await admin
    .from("tenant_dashboard_stats")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ stale: true, reason: "precomputed_error" });
  if (!row) return NextResponse.json({ stale: true, reason: "precomputed_missing" });

  const ageMs = Date.now() - new Date(row.computed_at as string).getTime();
  if (ageMs > PRECOMPUTED_MAX_STALE_MS) {
    return NextResponse.json({ stale: true, reason: "precomputed_stale" });
  }

  // Per-user tasks (small indexed query). Live because `assigned_to`
  // filter differs per caller.
  const tz = "Australia/Sydney";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  let tasksQ = admin
    .from("tasks")
    .select("id, title, priority, status, due_date, assigned_to")
    .eq("tenant_id", tenantId)
    .neq("status", "completed")
    .eq("due_date", today)
    .order("priority", { ascending: false })
    .limit(50);
  if (!isManager) tasksQ = tasksQ.eq("assigned_to", user.id);

  const hasPrecomputedActivity =
    Array.isArray(row.recent_activity) && (row.recent_activity as unknown[]).length > 0;

  let tasksResult: { data: LiveTaskRow[] | null };
  let recentActivityFallback;

  if (hasPrecomputedActivity) {
    tasksResult = (await tasksQ) as { data: LiveTaskRow[] | null };
  } else {
    const [t, j, r] = await Promise.all([
      tasksQ,
      admin
        .from("bespoke_jobs")
        .select("id, title, stage, updated_at, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5),
      admin
        .from("repairs")
        .select("id, item_description, stage, updated_at, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);
    tasksResult = t as { data: LiveTaskRow[] | null };
    recentActivityFallback = mergeRecentActivityFallback(
      (j.data ?? []) as Parameters<typeof mergeRecentActivityFallback>[0],
      (r.data ?? []) as Parameters<typeof mergeRecentActivityFallback>[1],
    );
  }

  const payload = hydrateDashboardStats(row as unknown as PrecomputedRow, {
    userId: user.id,
    isManager,
    tasks: tasksResult.data ?? [],
    recentActivityFallback,
  });

  return NextResponse.json(
    { ...payload, _source: "route" as const, computed_at: row.computed_at },
    {
      headers: {
        // Tenant-specific + user-specific data — never cache publicly.
        "Cache-Control": "private, no-store",
      },
    },
  );
}
