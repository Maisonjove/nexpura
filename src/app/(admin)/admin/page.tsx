import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const PLAN_PRICES: Record<string, number> = {
  boutique: 89,
  studio: 179,
  atelier: 299,
  // Legacy aliases
  group: 299,
  basic: 89,
  pro: 179,
  ultimate: 299,
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-stone-100 text-amber-700"
      : s === "trialing"
      ? "bg-amber-700/10 text-amber-700"
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
    p === "studio" || p === "pro"
      ? "bg-stone-100 text-amber-700"
      : p === "atelier" || p === "group" || p === "ultimate"
      ? "bg-amber-700/15 text-amber-700"
      : "bg-stone-200 text-stone-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {p || "—"}
    </span>
  );
}

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient();

  // Fetch all tenants
  const { data: tenants } = await adminClient
    .from("tenants")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  // Fetch all subscriptions
  const { data: subscriptions } = await adminClient
    .from("subscriptions")
    .select("tenant_id, plan, status, trial_ends_at, current_period_end");

  const subMap = new Map(
    (subscriptions ?? []).map((s) => [s.tenant_id, s])
  );

  const totalTenants = tenants?.length ?? 0;

  const activeCount = (subscriptions ?? []).filter(
    (s) => s.status === "active"
  ).length;

  const trialCount = (subscriptions ?? []).filter(
    (s) => s.status === "trialing"
  ).length;

  const suspendedCount = (subscriptions ?? []).filter(
    (s) => s.status === "suspended"
  ).length;

  const mrr = (subscriptions ?? []).reduce((sum, s) => {
    if (s.status === "active" || s.status === "trialing") {
      return sum + (PLAN_PRICES[s.plan] ?? 0);
    }
    return sum;
  }, 0);

  const recentTenants = (tenants ?? []).slice(0, 10);

  const stats = [
    { label: "Total Tenants", value: totalTenants, accent: false },
    { label: "Active (Paying)", value: activeCount, accent: true },
    { label: "Trialing", value: trialCount, accent: false },
    { label: "Suspended", value: suspendedCount, accent: false },
    { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, accent: true },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold font-semibold text-stone-900">Admin Dashboard</h1>
        <p className="text-sm text-stone-500 mt-1">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white rounded-xl border border-stone-200 p-4 ${
              stat.accent ? "ring-1 ring-sage/30" : ""
            }`}
          >
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-semibold font-semibold mt-1 ${stat.accent ? "text-amber-700" : "text-stone-900"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Signups */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900 font-semibold">Recent Signups</h2>
          <Link href="/admin/tenants" className="text-sm text-amber-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Business</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Trial / Period End</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum">
              {recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-stone-400">
                    No tenants yet
                  </td>
                </tr>
              ) : (
                recentTenants.map((tenant) => {
                  const sub = subMap.get(tenant.id);
                  return (
                    <tr key={tenant.id} className="hover:bg-stone-50/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">
                        <Link href={`/admin/tenants/${tenant.id}`} className="hover:text-amber-700">
                          {tenant.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <PlanBadge plan={sub?.plan} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={sub?.status} />
                      </td>
                      <td className="px-6 py-4 text-stone-500">
                        {formatDate(sub?.trial_ends_at || sub?.current_period_end)}
                      </td>
                      <td className="px-6 py-4 text-stone-500">{formatDate(tenant.created_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
