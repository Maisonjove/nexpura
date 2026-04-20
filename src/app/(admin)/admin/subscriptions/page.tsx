import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

// Force dynamic rendering - don't pre-render at build time

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-emerald-50 text-emerald-700"
      : s === "trialing"
      ? "bg-amber-50 text-amber-700"
      : s === "past_due"
      ? "bg-yellow-50 text-yellow-700"
      : "bg-red-50 text-red-600";
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
      ? "bg-stone-100 text-stone-700"
      : p === "atelier" || p === "group" || p === "ultimate"
      ? "bg-stone-200 text-stone-800"
      : "bg-stone-100 text-stone-600";
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

export default async function SubscriptionsPage() {
  const adminClient = createAdminClient();

  const { data: subs } = await adminClient
    .from("subscriptions")
    .select("*, tenants(id, name)")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Subscriptions</h1>
        <p className="text-sm text-stone-500 mt-1">{subs?.length ?? 0} subscriptions</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Tenant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Trial Ends</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Period End</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Stripe Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {(subs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-400">No subscriptions yet</td>
                </tr>
              ) : (
                (subs ?? []).map((sub) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const tenant = (sub as any).tenants;
                  return (
                    <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">
                        {tenant ? (
                          <Link href={`/admin/tenants/${tenant.id}`} className="hover:text-stone-600">
                            {tenant.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4"><PlanBadge plan={sub.plan} /></td>
                      <td className="px-6 py-4"><StatusBadge status={sub.status} /></td>
                      <td className="px-6 py-4 text-stone-500">{formatDate(sub.trial_ends_at)}</td>
                      <td className="px-6 py-4 text-stone-500">{formatDate(sub.current_period_end)}</td>
                      <td className="px-6 py-4 text-stone-500 font-mono text-xs">{sub.stripe_customer_id ?? "—"}</td>
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
