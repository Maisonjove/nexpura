import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { Skeleton } from "@/components/ui/skeleton";
import RepairsListClient from "./RepairsListClient";
import { locationScopeFilter } from "@/lib/location-read-scope";
import { ilikeOrValue } from "@/lib/db/or-escape";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";

export const metadata = { title: "Repairs — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

// Dynamic rendering is explicit — the page reads searchParams, auth,
// and DB inside its Suspense child. Making that explicit prevents Next
// from trying to prerender + failing on auth.
//
// The page no longer renders its own header — RepairsListClient owns the
// polished serif h1 + "Workshop" eyebrow + primary CTA so the layout stays
// consistent between the loading skeleton and the hydrated client view.

export default function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        <Suspense fallback={<RepairsBodySkeleton />}>
          <RepairsBody searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function RepairsBody({
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
  // Auth resolve + tenant lookup are now here (inside Suspense), so the
  // shell has already painted by the time this runs.
  let tenantId: string;
  let userId: string | null = null;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
    userId = headersList.get(AUTH_HEADERS.USER_ID);
  }

  const admin = createAdminClient();

  const statsPromise = admin
    .from("tenant_dashboard_stats")
    .select("repairs_stage_counts, repairs_overdue_count, repairs_hot_rows, computed_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let rawRepairs: unknown[] | null = null;
  let statsResult: Awaited<typeof statsPromise>;
  const authPromise = isReviewMode ? Promise.resolve(null) : getAuthContext();
  let auth: Awaited<ReturnType<typeof getAuthContext>> | null;

  // Location-scope filter for location-restricted users. All-access
  // users (owner/manager with null allowed_location_ids) get null and
  // the filter is skipped. See src/lib/location-read-scope.ts.
  // Review-mode bypasses auth — in that case no location restriction.
  const locationFilter = !isReviewMode && userId
    ? await locationScopeFilter(userId, tenantId)
    : null;

  if (q) {
    // W2-004: quote user input so `.`, `,`, `(`, `)`, `*` can't escape.
    const qIlike = ilikeOrValue(q);
    let liveQuery = admin
      .from("repairs")
      .select(
        `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
        customers(id, full_name)`
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(`repair_number.${qIlike},item_description.${qIlike},repair_type.${qIlike}`);
    if (locationFilter) liveQuery = liveQuery.or(locationFilter);
    const liveQueryFinal = liveQuery
      .order("created_at", { ascending: false })
      .limit(200);
    const [authRes, liveRes, statsRes] = await Promise.all([authPromise, liveQueryFinal, statsPromise]);
    auth = authRes;
    rawRepairs = liveRes.data as unknown[] | null;
    statsResult = statsRes;
  } else {
    const [authRes, statsRes] = await Promise.all([authPromise, statsPromise]);
    auth = authRes;
    statsResult = statsRes;

    // Snapshot path is always tenant-wide; only consult it for all-access
    // users. A location-restricted user must hit the live query so their
    // filter applies — otherwise they'd see the tenant-wide hot rows.
    const snapshot = statsResult.data?.repairs_hot_rows as unknown[] | null;
    const computedAt = statsResult.data?.computed_at as string | undefined;
    const ageMs = computedAt ? Date.now() - new Date(computedAt).getTime() : Infinity;
    const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
    if (!locationFilter && snapshot && ageMs < SNAPSHOT_MAX_AGE_MS) {
      rawRepairs = snapshot;
    } else {
      let q2 = admin
        .from("repairs")
        .select(
          `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
          customers(id, full_name)`
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (locationFilter) q2 = q2.or(locationFilter);
      const { data } = await q2
        .order("created_at", { ascending: false })
        .limit(200);
      rawRepairs = data as unknown[] | null;
    }
  }

  if (!isReviewMode && !auth) redirect("/login");

  const canView = isReviewMode ? true : (auth?.permissions.view_repairs ?? false);

  if (!canView) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="font-serif text-3xl text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to view repairs.</p>
      </div>
    );
  }

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

function RepairsBodySkeleton() {
  return (
    <div>
      {/* Header skeleton — matches the polished client header layout. */}
      <div className="flex items-start justify-between gap-6 mb-14">
        <div>
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Stat strip skeleton */}
      <div className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-y-8 gap-x-6 sm:divide-x sm:divide-stone-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="sm:px-8 sm:first:pl-0">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-10 w-16" />
          </div>
        ))}
      </div>

      {/* Stage tab pill row */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Card list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr_1.6fr_1fr_1fr_auto] gap-4 items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <div>
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
