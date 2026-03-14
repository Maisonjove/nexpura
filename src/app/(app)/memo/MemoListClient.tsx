"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMemoItem, updateMemoStatus, deleteMemoItem } from "./actions";
import type { MemoItem } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-50 text-blue-700",
  returned: "bg-stone-100 text-stone-600",
  sold: "bg-green-50 text-green-700",
  expired: "bg-amber-50 text-amber-700",
  lost: "bg-red-50 text-red-600",
};

interface Customer { id: string; first_name: string; last_name: string; email: string | null; }
interface Supplier { id: string; name: string; }

interface Props {
  items: MemoItem[];
  customers: Customer[];
  suppliers: Supplier[];
  tenantId: string;
}

export default function MemoListClient({ items, customers, suppliers, tenantId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"memo" | "consignment">("memo");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = items.filter((i) => {
    if (i.memo_type !== tab) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  const activeMemos = items.filter((i) => i.memo_type === "memo" && i.status === "active").length;
  const activeCons = items.filter((i) => i.memo_type === "consignment" && i.status === "active").length;
  const overdue = items.filter((i) => {
    if (i.status !== "active" || !i.due_back_date) return false;
    return new Date(i.due_back_date) < new Date();
  }).length;

  function handleQuickStatus(id: string, status: "returned" | "sold" | "expired" | "lost") {
    const extra: Record<string, string> = {};
    if (status === "returned") extra.returned_date = new Date().toISOString().split("T")[0];
    if (status === "sold") extra.sold_date = new Date().toISOString().split("T")[0];
    startTransition(async () => {
      await updateMemoStatus(id, status, extra as Parameters<typeof updateMemoStatus>[2]);
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("memo_type", tab);
    startTransition(async () => {
      const result = await createMemoItem(fd);
      if (result.error) { setError(result.error); return; }
      setShowForm(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Memo & Consignment</h1>
          <p className="text-sm text-stone-500 mt-0.5">Track items out on memo or received on consignment</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#7A6347]"
        >
          + New {tab === "memo" ? "Memo" : "Consignment"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Active Memos", value: activeMemos, icon: "📤" },
          { label: "Active Consignments", value: activeCons, icon: "📥" },
          { label: "Overdue", value: overdue, icon: "⚠️", warn: overdue > 0 },
        ].map((k) => (
          <div key={k.label} className={`bg-white rounded-xl border p-4 ${k.warn ? "border-amber-200" : "border-stone-200"}`}>
            <div className="text-xl mb-1">{k.icon}</div>
            <div className={`text-xl font-bold ${k.warn ? "text-amber-700" : "text-stone-900"}`}>{k.value}</div>
            <div className="text-xs text-stone-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-stone-100 rounded-xl p-1 w-fit">
        {(["memo", "consignment"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t === "memo" ? "📤 Memo Out" : "📥 Consignment In"}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "active", "returned", "sold", "expired", "lost"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? "bg-[#8B7355] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">{tab === "memo" ? "📤" : "📥"}</div>
          <p className="text-stone-600 font-medium">No {tab} items</p>
          <p className="text-sm mt-1">
            {tab === "memo" ? "Track items sent out on approval to customers" : "Track items received from suppliers on consignment"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isOverdue = item.status === "active" && item.due_back_date && new Date(item.due_back_date) < new Date();
            return (
              <div key={item.id} className={`bg-white rounded-xl border p-5 ${isOverdue ? "border-amber-300" : "border-stone-200"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-stone-900">{item.item_name}</span>
                      {item.memo_number && <span className="text-xs text-stone-400 font-mono">{item.memo_number}</span>}
                      {isOverdue && <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">Overdue</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-stone-400 flex-wrap">
                      {tab === "memo" && item.customer_name && <span>👤 {item.customer_name}</span>}
                      {tab === "consignment" && item.supplier_name && <span>🏢 {item.supplier_name}</span>}
                      {item.agreed_price && <span>💰 ${item.agreed_price.toLocaleString()}</span>}
                      {item.issued_date && <span>Issued {new Date(item.issued_date).toLocaleDateString("en-AU")}</span>}
                      {item.due_back_date && <span>Due {new Date(item.due_back_date).toLocaleDateString("en-AU")}</span>}
                    </div>
                    {item.metal && <div className="text-xs text-stone-400 mt-0.5">{item.metal}{item.stone ? ` · ${item.stone}` : ""}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[item.status] ?? "bg-stone-100 text-stone-600"}`}>
                      {item.status}
                    </span>
                    {item.status === "active" && (
                      <div className="relative group">
                        <button className="text-stone-400 hover:text-stone-600 p-1">⋯</button>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-32 z-10 hidden group-hover:block">
                          {tab === "memo" && (
                            <button onClick={() => handleQuickStatus(item.id, "returned")} className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">Mark Returned</button>
                          )}
                          <button onClick={() => handleQuickStatus(item.id, "sold")} className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50">Mark Sold</button>
                          <button onClick={() => handleQuickStatus(item.id, "expired")} className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50">Mark Expired</button>
                          <button onClick={() => handleQuickStatus(item.id, "lost")} className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50">Mark Lost</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">
                New {tab === "memo" ? "Memo" : "Consignment"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-stone-600 block mb-1">Item Name *</label>
                  <input name="item_name" required className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="e.g. Diamond Ring, Gold Necklace…" />
                </div>
                {tab === "memo" ? (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-stone-600 block mb-1">Customer</label>
                    <select name="customer_id" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-stone-600 block mb-1">Supplier</label>
                    <select name="supplier_id" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                      <option value="">Select supplier…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Retail Value</label>
                  <input name="retail_value" type="number" step="0.01" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Agreed Price</label>
                  <input name="agreed_price" type="number" step="0.01" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="0.00" />
                </div>
                {tab === "consignment" && (
                  <div>
                    <label className="text-xs font-medium text-stone-600 block mb-1">Commission %</label>
                    <input name="commission_rate" type="number" step="0.1" max="100" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="20" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Issued Date</label>
                  <input name="issued_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Due Back</label>
                  <input name="due_back_date" type="date" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Metal</label>
                  <input name="metal" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="Gold, Silver…" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">Stone</label>
                  <input name="stone" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder="Diamond, Ruby…" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-stone-600 block mb-1">Notes</label>
                  <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-3 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 px-3 py-2 bg-[#8B7355] text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {isPending ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
