import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

const statusBadge: Record<string, string> = {
  active: "bg-amber-50 text-amber-700",
  returned: "bg-stone-100 text-stone-600",
  sold: "bg-green-50 text-green-700",
  expired: "bg-amber-50 text-amber-700",
  lost: "bg-red-50 text-red-600",
};

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(Number(v));
}

export default async function ReviewMemoPage() {
  const admin = createAdminClient();

  const { data: raw } = await admin
    .from("memo_items")
    .select("id, memo_number, memo_type, status, customer_name, supplier_name, item_name, metal, stone, retail_value, agreed_price, commission_rate, issued_date, due_back_date")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false });

  const items = raw ?? [];
  const memos = items.filter((i) => i.memo_type === "memo");
  const consignments = items.filter((i) => i.memo_type === "consignment");
  const activeValue = items.filter((i) => i.status === "active").reduce((s, i) => s + (Number(i.retail_value) || 0), 0);
  const overdueItems = items.filter((i) => i.status === "active" && i.due_back_date && new Date(i.due_back_date) < new Date());

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Memo & Consignment</h1>
        <p className="text-sm text-stone-400 mt-0.5">{items.length} record{items.length !== 1 ? "s" : ""}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Active Memos</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{memos.filter((i) => i.status === "active").length}</p>
          <p className="text-xs text-stone-400 mt-0.5">items out on memo</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Consignments</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{consignments.filter((i) => i.status === "active").length}</p>
          <p className="text-xs text-stone-400 mt-0.5">items on consignment</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Active Value</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{fmt(activeValue)}</p>
          <p className="text-xs text-stone-400 mt-0.5">retail value at risk</p>
        </div>
        <div className={`rounded-xl border p-4 ${overdueItems.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-stone-200"}`}>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${overdueItems.length > 0 ? "text-red-700" : "text-stone-900"}`}>{overdueItems.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">past due-back date</p>
        </div>
      </div>

      {/* Memos table */}
      <div>
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Memo Out</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Ref</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Retail Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Issued</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Due Back</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-400">No memo items</td></tr>
              ) : (
                memos.map((m) => {
                  const isOverdue = m.status === "active" && m.due_back_date && new Date(m.due_back_date) < new Date();
                  return (
                    <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-stone-900">{m.memo_number || "—"}</td>
                      <td className="px-4 py-3 text-sm text-stone-700">{m.customer_name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-stone-700">
                        <div>{m.item_name}</div>
                        {(m.metal || m.stone) && <div className="text-xs text-stone-400">{[m.metal, m.stone].filter(Boolean).join(" · ")}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[m.status] ?? "bg-stone-100 text-stone-600"}`}>
                          {m.status.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-stone-900">{fmt(m.retail_value)}</td>
                      <td className="px-4 py-3 text-sm text-stone-500">{m.issued_date ? new Date(m.issued_date).toLocaleDateString("en-GB") : "—"}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${isOverdue ? "text-red-600" : "text-stone-500"}`}>
                        {m.due_back_date ? new Date(m.due_back_date).toLocaleDateString("en-GB") : "—"}
                        {isOverdue && <span className="ml-1 text-xs text-red-500">⚠ overdue</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consignments table */}
      <div>
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Consignment In</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Ref</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Consignor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Retail Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Commission</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Due Back</th>
              </tr>
            </thead>
            <tbody>
              {consignments.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-400">No consignment items</td></tr>
              ) : (
                consignments.map((c) => (
                  <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-stone-900">{c.memo_number || "—"}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">{c.supplier_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      <div>{c.item_name}</div>
                      {(c.metal || c.stone) && <div className="text-xs text-stone-400">{[c.metal, c.stone].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[c.status] ?? "bg-stone-100 text-stone-600"}`}>
                        {c.status.replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-stone-900">{fmt(c.retail_value)}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {c.commission_rate != null ? `${c.commission_rate}%` : "—"}
                      {c.commission_rate && c.retail_value
                        ? <span className="text-xs text-stone-400 ml-1">({fmt(Number(c.retail_value) * Number(c.commission_rate) / 100)})</span>
                        : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-500">{c.due_back_date ? new Date(c.due_back_date).toLocaleDateString("en-GB") : "—"}</td>
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
