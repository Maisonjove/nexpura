import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import BespokeListClient from "./BespokeListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function BespokePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";
  const admin = createAdminClient();

  // Check for review mode or auth
  let tenantId: string | null = null;
  let canView = false;
  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  if (isReviewMode) {
    tenantId = DEMO_TENANT;
    canView = true;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    canView = auth.permissions.view_bespoke;
  }

  if (!canView) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to view custom orders.</p>
      </div>
    );
  }

  // Load the 200 most-recent bespoke jobs once. Stage filtering is now
  // client-side — each tab click used to trigger a full RSC round-trip to
  // re-run the same query with a different `.eq("stage", …)`. With 200 rows
  // already in the client, filtering them via useMemo is ~1ms and instant.
  // Matches the pattern shipped for /repairs in PR #30.
  //
  // Server-side `q` (search) stays so deep-links like `?q=…` can still look
  // past the recent-200 cap.
  // HOT PATH: no search → read the 200-row snapshot + stage counts from
  // the precomputed tenant_dashboard_stats row (single indexed lookup).
  // DEEP PATH: ?q= → live ILIKE so search can reach past the snapshot cap.
  const statsPromise = admin
    .from("tenant_dashboard_stats")
    .select("bespoke_stage_counts, bespoke_overdue_count, bespoke_hot_rows, computed_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let rawJobs: unknown[] | null = null;
  let statsResult: Awaited<typeof statsPromise>;

  if (q) {
    const liveQuery = admin
      .from("bespoke_jobs")
      .select(
        `id, job_number, title, stage, priority, due_date, created_at,
         customers(id, full_name)`
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(`title.ilike.%${q}%,job_number.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(200);
    const [liveRes, statsRes] = await Promise.all([liveQuery, statsPromise]);
    rawJobs = liveRes.data as unknown[] | null;
    statsResult = statsRes;
  } else {
    statsResult = await statsPromise;
    const snapshot = statsResult.data?.bespoke_hot_rows as unknown[] | null;
    const computedAt = statsResult.data?.computed_at as string | undefined;
    const ageMs = computedAt ? Date.now() - new Date(computedAt).getTime() : Infinity;
    const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
    if (snapshot && ageMs < SNAPSHOT_MAX_AGE_MS) {
      rawJobs = snapshot;
    } else {
      const { data } = await admin
        .from("bespoke_jobs")
        .select(
          `id, job_number, title, stage, priority, due_date, created_at,
           customers(id, full_name)`
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      rawJobs = data as unknown[] | null;
    }
  }

  // Snapshot has customers inlined as object; live join may come as array.
  type RawBespoke = {
    id: string; job_number: string; title: string; stage: string; priority: string;
    due_date: string | null; created_at: string;
    customers: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
  };
  const jobs = (rawJobs as RawBespoke[] | null ?? []).map((j) => ({
    ...j,
    customers: Array.isArray(j.customers) ? (j.customers[0] ?? null) : j.customers,
  }));

  return (
    <BespokeListClient
      jobs={jobs}
      view={view}
      q={q}
      stageFilter={stageFilter}
      precomputedStageCounts={(statsResult.data?.bespoke_stage_counts as Record<string, number> | null) ?? null}
      precomputedOverdueCount={(statsResult.data?.bespoke_overdue_count as number | null) ?? null}
    />
  );
}
