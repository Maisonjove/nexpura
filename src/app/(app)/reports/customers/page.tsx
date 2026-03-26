import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { format } from "date-fns";
import { Users, TrendingUp, Heart, ShoppingBag } from "lucide-react";

export const metadata = { title: "Customer Reports — Nexpura" };

export default async function CustomerReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id ?? "";
  if (!tenantId) redirect("/onboarding");

  const allowed = await hasPermission(user.id, tenantId, "access_reports");
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to access Reports.</p>
      </div>
    );
  }

  // Fetch top customers by total spend
  const { data: topCustomers } = await supabase
    .from("customers")
    .select("id, full_name, email, is_vip, store_credit, sales(total)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .limit(10);

  // Aggregate spend (manual processing since Supabase doesn't support complex joins/aggregates in simple select)
  const customersWithSpend = (topCustomers || []).map(c => {
    const totalSpend = (c.sales as Array<{ total: number | null }> | null)?.reduce((sum, s) => sum + (Number(s.total) || 0), 0) || 0;
    return { ...c, totalSpend };
  }).sort((a, b) => b.totalSpend - a.totalSpend);

  const totalCustomers = customersWithSpend.length;
  const vipCount = customersWithSpend.filter(c => c.is_vip).length;
  const totalStoreCredit = customersWithSpend.reduce((sum, c) => sum + (Number(c.store_credit) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Customer Intelligence</h1>
        <p className="text-sm text-stone-500 mt-1">Analyze customer behavior and loyalty metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="p-2 w-fit rounded-lg bg-amber-50 text-amber-700 mb-4"><Users size={20} /></div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Customers</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">{totalCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="p-2 w-fit rounded-lg bg-amber-50 text-amber-600 mb-4"><Heart size={20} /></div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">VIP Members</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">{vipCount}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="p-2 w-fit rounded-lg bg-emerald-50 text-emerald-600 mb-4"><TrendingUp size={20} /></div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Avg. Lifetime Value</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">
            ${totalCustomers > 0 ? (customersWithSpend.reduce((sum, c) => sum + c.totalSpend, 0) / totalCustomers).toFixed(2) : "0.00"}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="p-2 w-fit rounded-lg bg-stone-100 text-stone-600 mb-4"><ShoppingBag size={20} /></div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Store Credit</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">${totalStoreCredit.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-bold text-stone-900 text-lg">Top 10 Customers by Spend</h2>
          <button className="text-sm font-semibold text-amber-700 hover:underline">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Customer</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Total Spend</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Store Credit</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {customersWithSpend.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-12 text-center text-stone-400 italic">No customer data found.</td></tr>
              ) : (
                customersWithSpend.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-stone-900">{c.full_name}</p>
                      <p className="text-xs text-stone-500">{c.email}</p>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-right text-stone-900">
                      ${c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-right text-stone-600">
                      ${(Number(c.store_credit) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-8 py-5 text-center">
                      {c.is_vip ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full">VIP</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-400 text-[10px] font-bold uppercase rounded-full">Standard</span>
                      )}
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
