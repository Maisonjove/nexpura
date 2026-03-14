import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Refunds — Nexpura" };

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default async function RefundsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) redirect("/onboarding");

  const admin = createAdminClient();
  const { data: refunds } = await admin
    .from("refunds")
    .select("id, refund_number, original_sale_id, customer_name, total, refund_method, reason, status, created_at")
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Refunds</h1>
          <p className="text-stone-500 text-sm mt-1">{(refunds ?? []).length} refund{(refunds ?? []).length !== 1 ? "s" : ""}</p>
        </div>
        <p className="text-sm text-stone-400">Process refunds from individual sale records</p>
      </div>

      {!refunds || refunds.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <p className="font-medium text-stone-900 mb-1">No refunds yet</p>
          <p className="text-sm text-stone-500">Process refunds from individual sale records.</p>
          <Link href="/sales" className="mt-4 inline-block text-sm text-[#8B7355] hover:underline font-medium">
            Go to Sales →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60">
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Refund #</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Reason</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Method</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {refunds.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono font-semibold text-stone-900">{r.refund_number}</td>
                  <td className="px-4 py-3 text-sm text-stone-700">{r.customer_name || <span className="text-stone-400">Walk-in</span>}</td>
                  <td className="px-4 py-3 text-sm text-stone-500 max-w-[160px] truncate">{r.reason || "—"}</td>
                  <td className="px-4 py-3 text-sm text-stone-500 capitalize">{r.refund_method || "—"}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">−{fmtCurrency(r.total)}</td>
                  <td className="px-4 py-3 text-sm text-stone-400">
                    {new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/refunds/${r.id}`} className="text-xs text-[#8B7355] hover:text-[#7a6447] font-medium transition-colors">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
