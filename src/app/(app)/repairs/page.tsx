import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAuthContext } from "@/lib/auth-context";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { Skeleton } from "@/components/ui/skeleton";
import RepairsListClient from "./RepairsListClient";

export const metadata = { title: "Repairs — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

// Dynamic rendering is explicit — the page reads searchParams, auth,
// and DB inside its Suspense child. Making that explicit prevents Next
// from trying to prerender + failing on auth.

// Synchronous top level — the shell (title + New Repair button + Suspense
// fallback skeleton) emits in the first streamed HTML chunk on hard-nav
// before the dynamic body (searchParams, auth, DB reads) resolves.
//
// searchParams is a Promise, passed by value into `<RepairsBody>` and
// awaited there inside the Suspense boundary. Awaiting it here would
// block the shell render.

export default function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; stage?: string; rt?: string }>;
}) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Shell: prerendered at build time, served from CDN edge. */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Repairs</h1>
        <Link
          href="/repairs/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-amber-700 hover:bg-amber-800 text-white h-10 px-4 py-2"
        >
          <Plus className="w-4 h-4 mr-2" /> New Repair
        </Link>
      </div>

      {/* Body — streamed. All dynamic APIs (searchParams, headers, auth,
          DB reads) live here so the shell above can be fully static. */}
      <Suspense fallback={<RepairsBodySkeleton />}>
        <RepairsBody searchParams={searchParams} />
      </Suspense>
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
  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));
  // Auth resolve + tenant lookup are now here (inside Suspense), so the
  // shell has already painted by the time this runs.
  let tenantId: string;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const headersList = await headers();
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!headerTenantId) redirect("/login");
    tenantId = headerTenantId;
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

  if (q) {
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
    const [authRes, statsRes] = await Promise.all([authPromise, statsPromise]);
    auth = authRes;
    statsResult = statsRes;

    const snapshot = statsResult.data?.repairs_hot_rows as unknown[] | null;
    const computedAt = statsResult.data?.computed_at as string | undefined;
    const ageMs = computedAt ? Date.now() - new Date(computedAt).getTime() : Infinity;
    const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
    if (snapshot && ageMs < SNAPSHOT_MAX_AGE_MS) {
      rawRepairs = snapshot;
    } else {
      const { data } = await admin
        .from("repairs")
        .select(
          `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at,
          customers(id, full_name)`
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
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
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
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
      hideTitleBlock
    />
  );
}

function RepairsBodySkeleton() {
  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto pb-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16 rounded-md flex-shrink-0" />
        ))}
      </div>
      <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-stone-100 text-xs font-medium uppercase tracking-wider text-stone-400">
          <span className="col-span-3">Customer</span>
          <span className="col-span-4">Item &amp; Issue</span>
          <span className="col-span-2">Status</span>
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
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="col-span-2"><Skeleton className="h-5 w-20 rounded-full" /></div>
              <div className="col-span-2"><Skeleton className="h-4 w-16" /></div>
              <div className="col-span-1 flex justify-center"><Skeleton className="h-4 w-4" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
