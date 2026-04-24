import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Laybys — Nexpura" };

export default async function LaybysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: laybys } = await admin
    .from("sales")
    .select("id, sale_number, customer_name, total, amount_paid, deposit_amount, status, sale_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("payment_method", "layby")
    .order("created_at", { ascending: false });

  const rows = laybys ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Laybys</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Manage layby orders and record instalment payments
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-stone-400 text-sm">
            No laybys yet. Create one from the POS screen.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Sale #</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Remaining</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((lb) => {
                const remaining = (lb.total || 0) - (lb.amount_paid || 0);
                const isActive = lb.status === "layby";
                return (
                  <tr key={lb.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-stone-700 text-xs">
                      {lb.sale_number}
                    </td>
                    <td className="px-4 py-3 text-stone-800 font-medium">
                      {lb.customer_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      ${(lb.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      ${(lb.amount_paid || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900">
                      ${Math.max(0, remaining).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {lb.sale_date
                        ? new Date(lb.sale_date).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/laybys/${lb.id}`}
                        className="text-xs font-medium text-amber-700 hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
