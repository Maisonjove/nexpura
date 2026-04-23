import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAuthContext } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import BespokeListClient from "./BespokeListClient";
import { locationScopeFilter } from "@/lib/location-read-scope";
import { ilikeOrValue } from "@/lib/db/or-escape";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";

export const metadata = { title: "Bespoke Jobs — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

// Dynamic rendering is explicit — see /repairs/page.tsx for the same
// pattern and rationale.

export default function BespokePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Bespoke Jobs</h1>
        <Link
          href="/bespoke/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-amber-700 hover:bg-amber-800 text-white h-10 px-4 py-2"
        >
          <Plus className="w-4 h-4 mr-2" /> New Job
        </Link>
      </div>

      <Suspense fallback={<BespokeBodySkeleton />}>
        <BespokeBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BespokeBody({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "pipeline";
  const q = params.q || "";
  const stageFilter = params.stage || "";
  // W7-HIGH-04: env-backed constant-time check.
  const isReviewMode = matchesReviewOrStaffToken(params.rt);
  let tenantId: string | null = null;
  let userId: string | null = null;
  let canView = false;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
    canView = true;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    userId = auth.userId;
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

  const admin = createAdminClient();

  const statsPromise = admin
    .from("tenant_dashboard_stats")
    .select("bespoke_stage_counts, bespoke_overdue_count, bespoke_hot_rows, computed_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let rawJobs: unknown[] | null = null;
  let statsResult: Awaited<typeof statsPromise>;

  // Location-scope filter for restricted users. See src/lib/location-read-scope.ts.
  const locationFilter = !isReviewMode && userId
    ? await locationScopeFilter(userId, tenantId)
    : null;

  if (q) {
    let liveQuery = admin
      .from("bespoke_jobs")
      .select(
        `id, job_number, title, stage, priority, due_date, created_at,
         customers(id, full_name)`
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      // W2-004: quote user input via ilikeOrValue so PostgREST metachars can't escape.
      .or((() => { const v = ilikeOrValue(q); return `title.${v},job_number.${v}`; })());
    if (locationFilter) liveQuery = liveQuery.or(locationFilter);
    const liveQueryFinal = liveQuery
      .order("created_at", { ascending: false })
      .limit(200);
    const [liveRes, statsRes] = await Promise.all([liveQueryFinal, statsPromise]);
    rawJobs = liveRes.data as unknown[] | null;
    statsResult = statsRes;
  } else {
    statsResult = await statsPromise;
    const snapshot = statsResult.data?.bespoke_hot_rows as unknown[] | null;
    const computedAt = statsResult.data?.computed_at as string | undefined;
    const ageMs = computedAt ? Date.now() - new Date(computedAt).getTime() : Infinity;
    const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
    // Snapshot path is tenant-wide. Only use it when the user has
    // all-access; restricted users must hit the live query to get
    // their filter applied.
    if (!locationFilter && snapshot && ageMs < SNAPSHOT_MAX_AGE_MS) {
      rawJobs = snapshot;
    } else {
      let q2 = admin
        .from("bespoke_jobs")
        .select(
          `id, job_number, title, stage, priority, due_date, created_at,
           customers(id, full_name)`
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (locationFilter) q2 = q2.or(locationFilter);
      const { data } = await q2
        .order("created_at", { ascending: false })
        .limit(200);
      rawJobs = data as unknown[] | null;
    }
  }

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
      hideTitleBlock
    />
  );
}

function BespokeBodySkeleton() {
  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto pb-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20 rounded-md flex-shrink-0" />
        ))}
      </div>
      <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-stone-100 text-xs font-medium uppercase tracking-wider text-stone-400">
          <span className="col-span-3">Customer</span>
          <span className="col-span-4">Title</span>
          <span className="col-span-2">Stage</span>
          <span className="col-span-2">Due</span>
          <span className="col-span-1"></span>
        </div>
        <div className="divide-y divide-stone-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-6 py-3 items-center">
              <div className="col-span-3 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="col-span-4">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="col-span-2"><Skeleton className="h-5 w-24 rounded-full" /></div>
              <div className="col-span-2"><Skeleton className="h-4 w-16" /></div>
              <div className="col-span-1 flex justify-center"><Skeleton className="h-4 w-4" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
