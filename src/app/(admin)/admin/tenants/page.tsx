import { createAdminClient } from "@/lib/supabase/admin";
import TenantsClient from "./TenantsClient";

interface SearchParams {
  q?: string;
  plan?: string;
  status?: string;
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const planFilter = params.plan ?? "";
  const statusFilter = params.status ?? "";

  const adminClient = createAdminClient();

  // Fetch all tenants with owner email
  const { data: tenants } = await adminClient
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  // Fetch all subscriptions
  const { data: subscriptions } = await adminClient
    .from("subscriptions")
    .select("tenant_id, plan, status, trial_ends_at, current_period_end");

  // Fetch all owner users
  const { data: owners } = await adminClient
    .from("users")
    .select("tenant_id, email")
    .eq("role", "owner");

  // Fetch active/pending support access requests
  const { data: supportAccess } = await adminClient
    .from("support_access_requests")
    .select("tenant_id, status, expires_at")
    .in("status", ["pending", "approved"]);

  const subMap = new Map(
    (subscriptions ?? []).map((s) => [s.tenant_id, s])
  );
  const ownerMap = new Map(
    (owners ?? []).map((u) => [u.tenant_id, u.email])
  );
  const accessMap = new Map(
    (supportAccess ?? []).map((a) => [a.tenant_id, a])
  );

  // Filter
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

  const PLAN_MRR: Record<string, number> = { boutique: 89, studio: 179, group: 0, basic: 89, pro: 179, ultimate: 0 };
  const totalMRR = (tenants ?? []).reduce((sum, t) => {
    const sub = subMap.get(t.id);
    if (sub?.status === "active" && sub?.plan) return sum + (PLAN_MRR[sub.plan] ?? 0);
    return sum;
  }, 0);
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
