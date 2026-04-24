/**
 * GET /api/dashboard/stats — Edge-runtime fast path for dashboard stats.
 *
 * Option C, dashboard cold-load reduction: the existing
 * `getDashboardStats` server action runs on the Node lambda and pays
 * the full cold-start cost on first hit. This Route Handler is the
 * Edge-runtime mirror of the precomputed fast path inside
 * `readPrecomputedStats` (dashboard/actions.ts:204-290).
 *
 * Behavior:
 *   - Reads the `tenant_dashboard_stats` precomputed aggregate row for
 *     the caller's tenant + enriches with small per-user live reads
 *     (today's tasks, recent jobs, recent repairs).
 *   - Returns the same `DashboardStatsData` shape the server action
 *     returns, so the SWR fetcher is a drop-in swap.
 *   - If the precomputed row is missing or stale (> PRECOMPUTED_MAX_STALE_MS
 *     old), responds with `{ stale: true }` and HTTP 200. The client
 *     then falls back to the heavy server-action path which recomputes
 *     live. We intentionally don't do the live-path inline here because
 *     it issues 20 parallel queries and isn't the cold-path shortcut
 *     Edge is optimised for.
 *
 * Runtime: edge. No Node APIs, no react-cache; every dependency is
 * Edge-compatible (Supabase-js v2 uses fetch, @supabase/ssr uses fetch,
 * shell-cookie helper uses Web Crypto, only cookies() is read).
 *
 * Auth:
 *   - Reads Supabase session cookie via @supabase/ssr.
 *   - Falls back to 401 if no session. No bearer/JWT shortcut — Edge
 *     function doesn't trust forged headers; middleware strips x-auth-*
 *     on every inbound request.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const PRECOMPUTED_MAX_STALE_MS = 60 * 1000;

type EdgeCookie = { name: string; value: string };

async function getCookies(req: NextRequest) {
  const all: EdgeCookie[] = [];
  req.cookies.getAll().forEach((c) => all.push({ name: c.name, value: c.value }));
  return all;
}

export async function GET(req: NextRequest) {
  // --- auth: read session via Supabase SSR (Edge-safe) ----------------
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

  // --- resolve tenant_id + role from users table ----------------------
  // Use the service-role client directly (bypasses RLS, matches the
  // existing server-action pattern) so the query stays O(1) and Edge-safe.
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

  // --- location filter from query param -------------------------------
  const locationIdsParam = req.nextUrl.searchParams.get("locationIds");
  const locationIds =
    locationIdsParam && locationIdsParam !== "all"
      ? locationIdsParam.split(",").filter(Boolean)
      : null;

  // Edge fast path only handles the tenant-wide precomputed case.
  // Per-location filtered reads require the heavier live path; defer
  // to the server action.
  if (locationIds && locationIds.length > 0) {
    return NextResponse.json({ stale: true, reason: "location_filter" });
  }

  // --- read precomputed row ------------------------------------------
  const { data: row, error } = await admin
    .from("tenant_dashboard_stats")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ stale: true, reason: "precomputed_error" });
  }
  if (!row) {
    return NextResponse.json({ stale: true, reason: "precomputed_missing" });
  }

  const ageMs = Date.now() - new Date(row.computed_at as string).getTime();
  if (ageMs > PRECOMPUTED_MAX_STALE_MS) {
    return NextResponse.json({ stale: true, reason: "precomputed_stale" });
  }

  // --- per-user enrichment (small, indexed reads) ---------------------
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

  const [allTasksResult, recentJobsResult, recentRepairsResult] = await Promise.all([
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

  // Merge precomputed aggregate + per-user live slices. The shape here
  // must match DashboardStatsData in dashboard/actions.ts — otherwise
  // the DashboardWrapper consumer renders wrong. Copy of the merge
  // logic from readPrecomputedStats.
  const payload = {
    ...(row.stats as Record<string, unknown>),
    tasks_today: allTasksResult.data ?? [],
    recent_bespoke: recentJobsResult.data ?? [],
    recent_repairs: recentRepairsResult.data ?? [],
    computed_at: row.computed_at,
    _source: "edge" as const,
  };

  return NextResponse.json(payload, {
    headers: {
      // Tenant-specific + user-specific data — never cache publicly.
      "Cache-Control": "private, no-store",
    },
  });
}
