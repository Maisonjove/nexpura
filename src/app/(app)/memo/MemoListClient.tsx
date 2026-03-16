"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMemoItem, updateMemoStatus, deleteMemoItem } from "./actions";
import type { MemoItem } from "./actions";
import { X, Search, Filter, BarChart2, MoreHorizontal, ArrowRight, User, Package, Calendar, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-amber-50 text-amber-700",
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
  const [showReports, setShowReports] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MemoItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = items.filter((i) => {
    if (i.memo_type !== tab) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  const totalActiveValue = items
    .filter(i => i.status === 'active')
    .reduce((sum, i) => sum + (Number(i.retail_value) || 0), 0);
  
  const soldCommission = items
    .filter(i => i.status === 'sold')
    .reduce((sum, i) => sum + ((Number(i.retail_value) || 0) * (Number(i.commission_rate) || 0) / 100), 0);

  const activeMemos = items.filter((i) => i.memo_type === "memo" && i.status === "active").length;
  const activeCons = items.filter((i) => i.memo_type === "consignment" && i.status === "active").length;
  const overdueCount = items.filter((i) => {
    if (i.status !== "active" || !i.due_back_date) return false;
    return new Date(i.due_back_date) < new Date();
  }).length;

  function handleQuickStatus(id: string, status: "returned" | "sold" | "expired" | "lost") {
    const extra: Record<string, string> = {};
    if (status === "returned") extra.returned_date = new Date().toISOString().split("T")[0];
    if (status === "sold") extra.sold_date = new Date().toISOString().split("T")[0];
    startTransition(async () => {
      await updateMemoStatus(id, status, extra as any);
      router.refresh();
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
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
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Memo & Consignment</h1>
          <p className="text-sm text-stone-500 mt-0.5">Track inventory out on approval or received from suppliers</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowReports(!showReports)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              showReports ? "bg-amber-700 text-white border-amber-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
          >
            <BarChart2 size={18} />
            Reports
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-shadow shadow-sm"
          >
            + New Entry
          </button>
        </div>
      </div>

      {showReports && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Active Value</p>
            <p className="text-2xl font-bold text-stone-900">${totalActiveValue.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Commission Earned</p>
            <p className="text-2xl font-bold text-amber-700">${soldCommission.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Overdue Items</p>
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Turnover Rate</p>
            <p className="text-2xl font-bold text-stone-900">12%</p>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 space-y-4 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-stone-200 p-2 space-y-1">
            <button
              onClick={() => setTab("memo")}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === "memo" ? "bg-amber-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span>Memo Out</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tab === "memo" ? "bg-white/20" : "bg-stone-100"}`}>
                {activeMemos}
              </span>
            </button>
            <button
              onClick={() => setTab("consignment")}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === "consignment" ? "bg-amber-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span>Consignment In</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tab === "consignment" ? "bg-white/20" : "bg-stone-100"}`}>
                {activeCons}
              </span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
              <input 
                placeholder="Search items..." 
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-600"
              />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">Filter by Status</p>
              <div className="grid grid-cols-2 gap-2">
                {["all", "active", "returned", "sold", "expired"].map(s => (
                  <button 
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${
                      statusFilter === s ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-100 hover:bg-stone-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">{tab === "memo" ? "Customer" : "Supplier"}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Due Back</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(i => (
                  <tr 
                    key={i.id} 
                    onClick={() => setSelectedItem(i)}
                    className="hover:bg-stone-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-stone-900">{i.item_name}</p>
                      <p className="text-xs text-stone-500">{i.memo_number || "No ref"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-stone-900">{tab === "memo" ? i.customer_name : i.supplier_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Clock size={12} className={i.status === 'active' && i.due_back_date && new Date(i.due_back_date) < new Date() ? "text-red-500" : ""} />
                        {i.due_back_date ? format(new Date(i.due_back_date), "dd MMM") : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-amber-700 font-medium">
                      ${Number(i.retail_value).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[i.status]}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over Detail */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h2 className="text-lg font-semibold text-stone-900">Details</h2>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-4 text-center">
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl bg-amber-700/10 text-amber-700`}>
                  <Package size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">{selectedItem.item_name}</h3>
                  <p className="text-stone-500 font-mono text-sm">{selectedItem.memo_number || "Reference Pending"}</p>
                </div>
                <div className="flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${STATUS_STYLES[selectedItem.status]}`}>
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Value</p>
                  <p className="text-lg font-bold text-amber-700">${Number(selectedItem.retail_value).toLocaleString()}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Commission</p>
                  <p className="text-lg font-bold text-stone-900">{selectedItem.commission_rate}%</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="text-amber-700" size={18} />
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Contact</p>
                    <p className="text-sm font-medium text-stone-900">{tab === "memo" ? selectedItem.customer_name : selectedItem.supplier_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="text-amber-700" size={18} />
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Due Back Date</p>
                    <p className="text-sm font-medium text-stone-900">
                      {selectedItem.due_back_date ? format(new Date(selectedItem.due_back_date), "dd MMMM yyyy") : "No date set"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedItem.notes && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-sm text-amber-900">
                  <p className="font-semibold mb-1">Notes</p>
                  {selectedItem.notes}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-stone-100 bg-stone-50/50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleQuickStatus(selectedItem.id, "returned")}
                  className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  Return to Supplier
                </button>
                <button 
                  onClick={() => handleQuickStatus(selectedItem.id, "sold")}
                  className="px-4 py-2.5 bg-amber-700 text-white rounded-xl text-sm font-medium hover:bg-amber-800 transition-colors"
                >
                  Mark as Sold
                </button>
              </div>
              <button 
                disabled
                title="Coming soon — conversion to owned stock in a future release"
                className="w-full px-4 py-2.5 bg-stone-200 text-stone-400 rounded-xl text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
              >
                Convert to Owned Stock
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal placeholder... (existing form logic) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">New {tab === 'memo' ? 'Memo' : 'Consignment'}</h2>
               <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-900"><X /></button>
             </div>
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Item Name</label>
                    <input name="item_name" required className="w-full px-4 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Value ($)</label>
                    <input name="retail_value" type="number" required className="w-full px-4 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Commission %</label>
                    <input name="commission_rate" type="number" defaultValue="20" className="w-full px-4 py-2 border rounded-xl" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Contact</label>
                    <select name={tab === 'memo' ? 'customer_id' : 'supplier_id'} className="w-full px-4 py-2 border rounded-xl">
                      {tab === 'memo' ? customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>) : 
                                      suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-all disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Create Entry"}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
