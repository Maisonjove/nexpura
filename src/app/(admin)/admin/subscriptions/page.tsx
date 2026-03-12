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

export default async function SubscriptionsPage() {
  const adminClient = createAdminClient();

  const { data: subs } = await adminClient
    .from("subscriptions")
    .select("*, tenants(id, name)")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-fraunces font-semibold text-forest">Subscriptions</h1>
        <p className="text-sm text-forest/50 mt-1">{subs?.length ?? 0} subscriptions</p>
      </div>

      <div className="bg-white rounded-xl border border-platinum overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-platinum bg-ivory/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Tenant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Trial Ends</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Period End</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-forest/50 uppercase tracking-wide">Stripe Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum">
              {(subs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-forest/40">No subscriptions yet</td>
                </tr>
              ) : (
                (subs ?? []).map((sub) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const tenant = (sub as any).tenants;
                  return (
                    <tr key={sub.id} className="hover:bg-ivory/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-forest">
                        {tenant ? (
                          <Link href={`/admin/tenants/${tenant.id}`} className="hover:text-sage">
                            {tenant.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4"><PlanBadge plan={sub.plan} /></td>
                      <td className="px-6 py-4"><StatusBadge status={sub.status} /></td>
                      <td className="px-6 py-4 text-forest/60">{formatDate(sub.trial_ends_at)}</td>
                      <td className="px-6 py-4 text-forest/60">{formatDate(sub.current_period_end)}</td>
                      <td className="px-6 py-4 text-forest/60 font-mono text-xs">{sub.stripe_customer_id ?? "—"}</td>
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
