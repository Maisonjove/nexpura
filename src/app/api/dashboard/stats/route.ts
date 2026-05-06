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
import { resolveReadLocationScope } from "@/lib/location-read-scope";
import { ServerTiming } from "@/lib/server-timing";

const PRECOMPUTED_MAX_STALE_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
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
  const user = await timing.measure("auth", async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  });
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: serverTimingHeader(timing) },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const userRow = await timing.measure("user_lookup", async () => {
    const { data } = await admin
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();
    return data;
  });
  const tenantId = (userRow as { tenant_id?: string; role?: string } | null)?.tenant_id;
  const role = (userRow as { tenant_id?: string; role?: string } | null)?.role ?? "staff";
  if (!tenantId) {
    return NextResponse.json(
      { error: "No tenant" },
      { status: 403, headers: serverTimingHeader(timing) },
    );
  }
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

  // Sibling to PR #203 (post-audit/widget-list-reconciliation,
  // CONTRIBUTING.md §17.1). The precomputed `tenant_dashboard_stats`
  // row is tenant-wide. Serving it to a location-restricted user (one
  // with a non-null `team_members.allowed_location_ids`) leaks
  // aggregates from locations they can't access — exactly the
  // widget-vs-list scope-bypass shape PR #203 closed.
  //
  // For restricted users we mark stale and let the SWR fetcher fall
  // through to the server-action live path, which now applies
  // `team_members.allowed_location_ids` via `addLocFilter`'s OR-NULL
  // hygiene. The `addLocFilter`-side fix in
  // src/app/(app)/dashboard/actions.ts is the canonical owner of the
  // scope rule; this handler defers to it by refusing to short-circuit.
  const scope = await timing.measure("scope_resolve", () =>
    resolveReadLocationScope(user.id, tenantId),
  );
  if (!scope.all) {
    return NextResponse.json(
      { stale: true, reason: "location_restricted" },
      { headers: serverTimingHeader(timing) },
    );
  }

  const { data: row, error } = await timing.measure("precomputed_read", async () =>
    admin
      .from("tenant_dashboard_stats")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  );

  if (error)
    return NextResponse.json(
      { stale: true, reason: "precomputed_error" },
      { headers: serverTimingHeader(timing) },
    );
  if (!row)
    return NextResponse.json(
      { stale: true, reason: "precomputed_missing" },
      { headers: serverTimingHeader(timing) },
    );

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
        ...serverTimingHeader(timing),
      },
    },
  );
}

/**
 * Stamps the Server-Timing header onto a response unless no metrics
 * were recorded. Returns an empty object so it can be spread into
 * Headers init without a separate guard.
 */
function serverTimingHeader(timing: ServerTiming): Record<string, string> {
  const value = timing.toHeader();
  return value ? { "Server-Timing": value } : {};
}
