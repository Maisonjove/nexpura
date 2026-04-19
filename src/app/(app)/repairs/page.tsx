import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import RepairsListClient from "./RepairsListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";
  const admin = createAdminClient();

  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  // Resolve tenantId instantly from middleware headers (no Supabase round-trip).
  // For review mode: use the demo tenant constant.
  let tenantId: string;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
  }

  // HOT PATH: no search query → read the 200-row snapshot + stage counts
  // from the precomputed tenant_dashboard_stats row in a single query.
  // One indexed row read replaces the full 200-row live fetch. pg_cron
  // + write-trigger refreshes keep the snapshot <60 s stale at all times.
  //
  // DEEP PATH: `?q=` present → run the live ILIKE so search can reach
  // past the 200-row snapshot cap (deep-link REP-047, camera scanner,
  // old-repair lookup). Snapshot-side stage counts are still pulled
  // in parallel from the same row.
  const statsPromise = admin
    .from("tenant_dashboard_stats")
    .select("repairs_stage_counts, repairs_overdue_count, repairs_hot_rows, computed_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let rawRepairs: unknown[] | null = null;
  let statsResult: Awaited<typeof statsPromise>;
  const authPromise = isReviewMode ? Promise.resolve(null) : getAuthContext();
  let auth: Awaited<ReturnType<typeof getAuthContext>> | null;

  if (q) {
    // Deep-search path: live fetch with ILIKE, still pull stats in parallel
    // so tab-count chips remain accurate.
    const liveQuery = admin
      .from("repairs")
      .select(
        `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
        customers(id, full_name)`
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(
        `repair_number.ilike.%${q}%,item_description.ilike.%${q}%,repair_type.ilike.%${q}%`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const [authRes, liveRes, statsRes] = await Promise.all([authPromise, liveQuery, statsPromise]);
    auth = authRes;
    rawRepairs = liveRes.data as unknown[] | null;
    statsResult = statsRes;
  } else {
    // Hot path: auth + single stats-row read.
    const [authRes, statsRes] = await Promise.all([authPromise, statsPromise]);
    auth = authRes;
    statsResult = statsRes;

    // Use the snapshot if it exists AND is <5 min old (conservative; the
    // write-trigger + pg_cron flow keeps it <60 s normally, but if the
    // scheduler lagged or a refresh failed, we'd rather fall back to a
    // live fetch than show a multi-minute-old list).
    const snapshot = statsResult.data?.repairs_hot_rows as unknown[] | null;
    const computedAt = statsResult.data?.computed_at as string | undefined;
    const ageMs = computedAt ? Date.now() - new Date(computedAt).getTime() : Infinity;
    const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
    if (snapshot && ageMs < SNAPSHOT_MAX_AGE_MS) {
      rawRepairs = snapshot;
    } else {
      // Fallback: live fetch when snapshot missing or unexpectedly stale.
      const liveQuery = admin
        .from("repairs")
        .select(
          `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
          customers(id, full_name)`
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const { data } = await liveQuery;
      rawRepairs = data as unknown[] | null;
    }
  }

  if (!isReviewMode && !auth) redirect("/login");

  const canView = isReviewMode ? true : (auth?.permissions.view_repairs ?? false);

  if (!canView) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to view repairs.</p>
      </div>
    );
  }

  // Snapshot already has customers inlined as an object (not array). Live
  // Supabase joins sometimes come back as array. Normalise both shapes.
  type RawRepair = {
    id: string; repair_number: string; item_type: string; item_description: string;
    repair_type: string; stage: string; priority: string;
    due_date: string | null; created_at: string;
    customers: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
  };
  const repairs = (rawRepairs as RawRepair[] | null ?? []).map((r) => ({
    ...r,
    customers: Array.isArray(r.customers)
      ? (r.customers[0] ?? null)
      : r.customers,
  }));

  return (
    <RepairsListClient
      repairs={repairs}
      view={view}
      q={q}
      stageFilter={stageFilter}
      precomputedStageCounts={(statsResult.data?.repairs_stage_counts as Record<string, number> | null) ?? null}
      precomputedOverdueCount={(statsResult.data?.repairs_overdue_count as number | null) ?? null}
    />
  );
}
