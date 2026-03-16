import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const PLAN_PRICES: Record<string, number> = {
  basic: 49,
  pro: 99,
  ultimate: 199,
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export const metadata = { title: "Revenue — Nexpura Admin" };

export default async function RevenueAdminPage() {
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("subscriptions")
    .select("tenant_id, plan, status, trial_ends_at, current_period_end, created_at");

  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, created_at, is_free_forever");

  const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t]));

  const activeSubs = (subs ?? []).filter((s) => s.status === "active");
  const trialSubs = (subs ?? []).filter((s) => s.status === "trialing");
  const pastDueSubs = (subs ?? []).filter((s) => s.status === "past_due");
  const cancelledSubs = (subs ?? []).filter((s) => s.status === "canceled" || s.status === "cancelled");

  const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan] ?? 0), 0);
  const arr = mrr * 12;

  // Plan breakdown
  const planBreakdown = { basic: 0, pro: 0, ultimate: 0 };
  for (const s of activeSubs) {
    if (s.plan in planBreakdown) planBreakdown[s.plan as keyof typeof planBreakdown]++;
  }

  // Churn rate (cancelled / total)
  const churnRate = (subs ?? []).length > 0
    ? ((cancelledSubs.length / (subs ?? []).length) * 100).toFixed(1)
    : "0.0";

  // Conversion rate (active / (active + trialing + cancelled))
  const conversionBase = activeSubs.length + trialSubs.length + cancelledSubs.length;
  const conversionRate = conversionBase > 0
    ? ((activeSubs.length / conversionBase) * 100).toFixed(1)
    : "0.0";

  // Recently joined (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newTenants = (tenants ?? []).filter((t) => t.created_at > thirtyDaysAgo).length;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 mb-1 inline-block">← Admin</Link>
          <h1 className="text-2xl font-semibold text-stone-900">Revenue Overview</h1>
          <p className="text-sm text-stone-500 mt-0.5">Live MRR, ARR, plan breakdown, and subscription metrics</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "MRR", value: fmtCurrency(mrr), icon: "💰", sub: "Monthly Recurring Revenue" },
          { label: "ARR", value: fmtCurrency(arr), icon: "📈", sub: "Annual Run Rate" },
          { label: "Active Subscriptions", value: activeSubs.length, icon: "✓", sub: "Paying tenants" },
          { label: "New (30d)", value: newTenants, icon: "🆕", sub: "New tenants" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className="text-2xl font-bold text-stone-900">{k.value}</div>
            <div className="text-xs text-stone-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Trialing", value: trialSubs.length, color: "text-amber-700" },
          { label: "Past Due", value: pastDueSubs.length, color: pastDueSubs.length > 0 ? "text-red-600" : "text-stone-900" },
          { label: "Churned", value: cancelledSubs.length, color: cancelledSubs.length > 5 ? "text-red-600" : "text-stone-900" },
          { label: "Churn Rate", value: `${churnRate}%`, color: "text-stone-900" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-4">
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-stone-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Plan Distribution (Active)</h2>
          <div className="space-y-3">
            {Object.entries(planBreakdown).map(([plan, count]) => {
              const pct = activeSubs.length > 0 ? Math.round((count / activeSubs.length) * 100) : 0;
              const revenue = count * (PLAN_PRICES[plan] ?? 0);
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-stone-900 capitalize">{plan}</span>
                    <span className="text-stone-500">{count} tenants · {fmtCurrency(revenue)}/mo</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-700 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Conversion Funnel</h2>
          <div className="space-y-3">
            {[
              { label: "Total Signups", value: (tenants ?? []).length, width: 100 },
              { label: "Trialing", value: trialSubs.length, width: (tenants ?? []).length > 0 ? (trialSubs.length / (tenants ?? []).length) * 100 : 0 },
              { label: "Active (Paid)", value: activeSubs.length, width: (tenants ?? []).length > 0 ? (activeSubs.length / (tenants ?? []).length) * 100 : 0 },
              { label: "Conversion Rate", value: `${conversionRate}%`, width: parseFloat(conversionRate) },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-600">{row.label}</span>
                  <span className="font-medium text-stone-900">{row.value}</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-700/60 rounded-full"
                    style={{ width: `${row.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active subscriptions table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Active Subscriptions</h2>
          <span className="text-xs text-stone-400">{activeSubs.length} tenants · {fmtCurrency(mrr)} MRR</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-stone-500">MRR</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Renews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {activeSubs.map((sub) => {
                const tenant = tenantMap.get(sub.tenant_id);
                return (
                  <tr key={sub.tenant_id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tenants/${sub.tenant_id}`} className="font-medium text-stone-900 hover:text-amber-700">
                        {tenant?.name ?? "Unknown"}
                      </Link>
                      {tenant?.is_free_forever && (
                        <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Free</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-stone-700">{sub.plan}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">
                      {tenant?.is_free_forever ? "—" : fmtCurrency(PLAN_PRICES[sub.plan] ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {sub.current_period_end ? fmtDate(sub.current_period_end) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past due / at risk */}
      {pastDueSubs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-red-800 mb-3">⚠️ At Risk — Payment Required ({pastDueSubs.length})</h2>
          <div className="space-y-2">
            {pastDueSubs.map((sub) => {
              const tenant = tenantMap.get(sub.tenant_id);
              return (
                <div key={sub.tenant_id} className="flex items-center justify-between">
                  <Link href={`/admin/tenants/${sub.tenant_id}`} className="text-sm font-medium text-red-800 hover:text-red-900">
                    {tenant?.name ?? "Unknown"}
                  </Link>
                  <span className="text-xs text-red-600 capitalize">{sub.plan}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
