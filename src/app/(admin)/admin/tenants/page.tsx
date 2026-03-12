import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-sage/15 text-sage"
      : s === "trialing"
      ? "bg-blue-500/10 text-blue-600"
      : s === "past_due"
      ? "bg-yellow-500/10 text-yellow-700"
      : "bg-red-500/10 text-red-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {s.replace("_", " ") || "—"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const p = (plan ?? "").toLowerCase();
  const cls =
    p === "pro"
      ? "bg-sage/15 text-sage"
      : p === "ultimate"
      ? "bg-gold/15 text-gold"
      : "bg-platinum text-forest/60";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "—"}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

  const subMap = new Map(
    (subscriptions ?? []).map((s) => [s.tenant_id, s])
  );
  const ownerMap = new Map(
    (owners ?? []).map((u) => [u.tenant_id, u.email])
  );

  // Filter
  let filtered = (tenants ?? []).map((t) => ({
    ...t,
    sub: subMap.get(t.id),
    ownerEmail: ownerMap.get(t.id) ?? "—",
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-fraunces font-semibold text-forest">Tenants</h1>
        <p className="text-sm text-forest/50 mt-1">
          {filtered.length} tenant{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by business name or email…"
          className="flex-1 min-w-[200px] px-4 py-2 border border-platinum rounded-lg text-sm text-forest bg-white focus:outline-none focus:ring-2 focus:ring-sage/30"
        />
        <select
          name="plan"
          defaultValue={planFilter}
          className="px-3 py-2 border border-platinum rounded-lg text-sm text-forest bg-white focus:outline-none focus:ring-2 focus:ring-sage/30"
        >
          <option value="">All Plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="ultimate">Ultimate</option>
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="px-3 py-2 border border-platinum rounded-lg text-sm text-forest bg-white focus:outline-none focus:ring-2 focus:ring-sage/30"
        >
          <option value="">All Statuses</option>
          <option value="trialing">Trialing</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Cancelled</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-sage text-white rounded-lg text-sm font-medium hover:bg-sage/90 transition-colors"
        >
          Filter
        </button>
        {(query || planFilter || statusFilter) && (
          <Link
            href="/admin/tenants"
            className="px-4 py-2 border border-platinum text-forest/60 rounded-lg text-sm hover:bg-ivory transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-platinum overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-platinum bg-ivory/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Business</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Owner Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Trial / Billing</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Signed Up</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-forest/40">
                    No tenants found
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-ivory/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-forest">{tenant.name}</td>
                    <td className="px-6 py-4 text-forest/60">{tenant.ownerEmail}</td>
                    <td className="px-6 py-4">
                      <PlanBadge plan={tenant.sub?.plan} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tenant.sub?.status} />
                    </td>
                    <td className="px-6 py-4 text-forest/60">
                      {formatDate(tenant.sub?.trial_ends_at || tenant.sub?.current_period_end)}
                    </td>
                    <td className="px-6 py-4 text-forest/60">{formatDate(tenant.created_at)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="px-3 py-1.5 text-xs bg-forest text-white rounded-lg hover:bg-forest/80 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
