import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import TenantsClient from "./TenantsClient";
import logger from "@/lib/logger";
import { calculateMRR } from "@/lib/plans";

/**
 * /admin/tenants — CC-ready page-route (admin-cluster cleanup pass).
 *
 * Sync top-level → Suspense → async body. Body awaits the `searchParams`
 * promise (filters) then calls a pure loader. The `searchParams` awaiting
 * is a request-scoped op under CC, so it correctly lives inside the body.
 *
 * `loadTenantsData()` takes the full raw query as a param — with
 * cacheComponents on, it's still dynamic-by-default per-query. If we
 * later want to pre-cache the filterless view, split the base query
 * from the client-side filter.
 */


interface SearchParams {
  q?: string;
  plan?: string;
  status?: string;
}

export default function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Shell — pure static. The filter state + table are in the
          Suspense body because they depend on resolved searchParams. */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Tenants</h1>
        <p className="text-sm text-stone-500 mt-1">All tenants across the platform</p>
      </div>
      <Suspense fallback={<TenantsBodySkeleton />}>
        <TenantsBody searchParamsPromise={searchParams} />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Awaits searchParams (request-scoped), then does DB reads.
// ─────────────────────────────────────────────────────────────────────────
async function TenantsBody({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<SearchParams>;
}) {
  const params = await searchParamsPromise;
  const query = params.q ?? "";
  const planFilter = params.plan ?? "";
  const statusFilter = params.status ?? "";

  const { tenants, subscriptions, owners, supportAccess } = await loadTenantsData();

  const subMap = new Map(
    (subscriptions ?? []).map((s) => [s.tenant_id, s])
  );
  const ownerMap = new Map(
    (owners ?? []).map((u) => [u.tenant_id, u.email])
  );
  const accessMap = new Map(
    (supportAccess ?? []).map((a) => [a.tenant_id, a])
  );

  let filtered = (tenants ?? []).map((t) => ({
    ...t,
    sub: subMap.get(t.id),
    ownerEmail: ownerMap.get(t.id) ?? "—",
    supportAccess: accessMap.get(t.id),
  }));

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.ownerEmail.toLowerCase().includes(q)
    );
  }

  if (planFilter) {
    filtered = filtered.filter((t) => t.sub?.plan === planFilter);
  }

  if (statusFilter) {
    filtered = filtered.filter((t) => t.sub?.status === statusFilter);
  }

  // Group 16 audit: pre-fix this had a hand-rolled PLAN_MRR table that
  // was missing the 'atelier' key entirely (and counted legacy 'group'
  // / 'ultimate' as $0), so any atelier tenant — the most common
  // active plan on prod — counted as $0 toward the MRR shown on this
  // page. /admin showed $2,451, /admin/revenue $1,076, /admin/tenants
  // $179 — three different numbers for the same dataset. Routed
  // through the canonical calculateMRR helper so all three pages now
  // agree.
  const subsForMRR = (subscriptions ?? []).map((s) => ({ tenant_id: s.tenant_id, plan: s.plan, status: s.status }));
  const tenantMap = new Map(
    (tenants ?? []).map((t) => [t.id, { is_free_forever: t.is_free_forever ?? false }]),
  );
  const totalMRR = calculateMRR(subsForMRR, tenantMap);
  const activeTenants = (tenants ?? []).filter((t) => subMap.get(t.id)?.status === "active").length;
  const trialTenants = (tenants ?? []).filter((t) => subMap.get(t.id)?.status === "trialing").length;

  return (
    <TenantsClient
      tenants={filtered}
      totalMRR={totalMRR}
      activeTenants={activeTenants}
      trialTenants={trialTenants}
      query={query}
      planFilter={planFilter}
      statusFilter={statusFilter}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. No inputs; admin-wide view.
// ─────────────────────────────────────────────────────────────────────────
interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_free_forever?: boolean | null;
  created_at: string;
  deleted_at: string | null;
}
interface SubRow {
  tenant_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}
interface OwnerRow {
  tenant_id: string;
  email: string;
}
interface SupportAccessRow {
  tenant_id: string;
  status: string;
  expires_at: string | null;
}

async function loadTenantsData(): Promise<{
  tenants: TenantRow[] | null;
  subscriptions: SubRow[] | null;
  owners: OwnerRow[] | null;
  supportAccess: SupportAccessRow[] | null;
}> {
  try {
    const adminClient = createAdminClient();

    const [tenantsRes, subsRes, ownersRes, supportAccessRes] = await Promise.all([
      adminClient
        .from("tenants")
        .select("id, name, slug, is_free_forever, created_at, deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      adminClient
        .from("subscriptions")
        .select("tenant_id, plan, status, trial_ends_at, current_period_end"),
      adminClient.from("users").select("tenant_id, email").eq("role", "owner"),
      adminClient
        .from("support_access_requests")
        .select("tenant_id, status, expires_at")
        .in("status", ["pending", "approved"]),
    ]);

    return {
      tenants: tenantsRes.data,
      subscriptions: subsRes.data,
      owners: ownersRes.data,
      supportAccess: supportAccessRes.data,
    };
  } catch (error) {
    logger.error("[admin/tenants] loadTenantsData failed", error);
    return { tenants: [], subscriptions: [], owners: [], supportAccess: [] };
  }
}

function TenantsBodySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <Skeleton className="h-14 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full border-t border-stone-100" />
        ))}
      </div>
    </div>
  );
}
