"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMemoItem, updateMemoStatus } from "./actions";
import type { MemoItem } from "./actions";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ArrowRightIcon,
  UserIcon,
  ArchiveBoxIcon,
  CalendarIcon,
  ClockIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, string> = {
  active: "nx-badge-warning",
  returned: "nx-badge-neutral",
  sold: "nx-badge-success",
  expired: "nx-badge-warning",
  lost: "nx-badge-danger",
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

  const [searchTerm, setSearchTerm] = useState("");

  const filtered = items.filter((i) => {
    if (i.memo_type !== tab) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const hay = [
        i.item_name,
        i.memo_number,
        // customer/supplier name lookups happen below the table; we
        // search the item's own searchable fields here.
        (i as { notes?: string | null }).notes ?? "",
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
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

  // Turnover = sold count / (sold + active + returned). Captures how often
  // a consignor's stock actually sells, not pure sold/active.
  const soldCount = items.filter((i) => i.status === "sold").length;
  const turnoverDenom = items.filter((i) => ["sold", "active", "returned"].includes(i.status)).length;
  const turnoverPct = turnoverDenom > 0 ? Math.round((soldCount / turnoverDenom) * 100) : 0;

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

  const STATUS_FILTERS = ["all", "active", "returned", "sold", "expired"];

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Inventory
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight">
              Memo & Consignment
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Track inventory out on approval or received from suppliers.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowReports(!showReports)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                showReports
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              <ChartBarIcon className="w-4 h-4" />
              Reports
            </button>
            <Link
              href={`/memo/new?type=${tab}`}
              className="nx-btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              New {tab === "memo" ? "Memo" : "Consignment"}
            </Link>
          </div>
        </div>

        {/* Reports */}
        {showReports && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 md:gap-6 mb-10">
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Active Value
              </p>
              <p className="font-serif text-3xl text-stone-900 tabular-nums">
                ${totalActiveValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Commission Earned
              </p>
              <p className="font-serif text-3xl text-stone-900 tabular-nums">
                ${soldCommission.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Overdue Items
              </p>
              <p className="font-serif text-3xl text-stone-900 tabular-nums">
                {overdueCount}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                Turnover Rate
              </p>
              <p className="font-serif text-3xl text-stone-900 tabular-nums">
                {turnoverPct}%
              </p>
            </div>
          </div>
        )}

        {/* Type Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setTab("memo")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              tab === "memo"
                ? "bg-stone-900 text-white"
                : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            Memo Out
            <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
              tab === "memo" ? "bg-white/20" : "bg-stone-100 text-stone-500"
            }`}>
              {activeMemos}
            </span>
          </button>
          <button
            onClick={() => setTab("consignment")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              tab === "consignment"
                ? "bg-stone-900 text-white"
                : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            Consignment In
            <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
              tab === "consignment" ? "bg-white/20" : "bg-stone-100 text-stone-500"
            }`}>
              {activeCons}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {STATUS_FILTERS.map((s) => {
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap capitalize transition-all duration-300 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Memo list */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <ArchiveBoxIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              {statusFilter === "all"
                ? `No ${tab === "memo" ? "memos" : "consignments"} yet`
                : `No ${statusFilter} ${tab === "memo" ? "memos" : "consignments"}`}
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              {statusFilter === "all"
                ? tab === "memo"
                  ? "Create a memo to track items out with customers on approval."
                  : "Record items received from suppliers on consignment."
                : "Try a different filter to see other entries."}
            </p>
            {statusFilter !== "all" ? (
              <button
                onClick={() => setStatusFilter("all")}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                View all
              </button>
            ) : (
              <Link
                href={`/memo/new?type=${tab}`}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                New {tab === "memo" ? "Memo" : "Consignment"}
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((i) => {
              const isOverdue =
                i.status === "active" &&
                i.due_back_date &&
                new Date(i.due_back_date) < new Date();
              const badgeClass = STATUS_BADGE[i.status] || "nx-badge-neutral";

              return (
                <button
                  key={i.id}
                  onClick={() => setSelectedItem(i)}
                  className="group block w-full text-left bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2.5">
                        <span className="font-mono text-xs text-stone-400 tabular-nums">
                          {i.memo_number ?? "—"}
                        </span>
                        <span className={badgeClass}>{i.status}</span>
                        <span className="text-[0.6875rem] uppercase tracking-luxury text-stone-400">
                          {i.memo_type === "memo" ? "Memo Out" : "Consignment In"}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                        {i.item_name}
                      </h3>
                      <div className="flex items-center gap-5 flex-wrap mt-4 text-sm text-stone-500">
                        <span className="inline-flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-stone-700">
                            {tab === "memo" ? i.customer_name ?? "—" : i.supplier_name ?? "—"}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className={`w-3.5 h-3.5 ${isOverdue ? "text-rose-500" : "text-stone-400"}`} />
                          <span className={isOverdue ? "text-rose-600" : "text-stone-700"}>
                            {i.due_back_date ? format(new Date(i.due_back_date), "dd MMM yyyy") : "No due date"}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                          Value
                        </p>
                        <p className="font-serif text-2xl text-stone-900 leading-none tracking-tight tabular-nums">
                          ${Number(i.retail_value).toLocaleString()}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                        View
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-over Detail */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-[0_24px_64px_rgba(0,0,0,0.12)] flex flex-col">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-stone-900">Details</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="text-center space-y-4 pt-2">
                <p className="text-[0.6875rem] uppercase tracking-luxury text-stone-400">
                  {selectedItem.memo_type === "memo" ? "Memo Out" : "Consignment In"}
                </p>
                <div>
                  <h3 className="font-serif text-2xl text-stone-900 leading-tight tracking-tight">
                    {selectedItem.item_name}
                  </h3>
                  <p className="font-mono text-xs text-stone-400 tabular-nums mt-2">
                    {selectedItem.memo_number || "Reference pending"}
                  </p>
                </div>
                <div className="flex justify-center">
                  <span className={STATUS_BADGE[selectedItem.status] || "nx-badge-neutral"}>
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                    Value
                  </p>
                  <p className="font-serif text-xl text-stone-900 tabular-nums">
                    ${Number(selectedItem.retail_value).toLocaleString()}
                  </p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                    Commission
                  </p>
                  <p className="font-serif text-xl text-stone-900 tabular-nums">
                    {selectedItem.commission_rate}%
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                      Contact
                    </p>
                    <p className="text-sm text-stone-900">
                      {tab === "memo" ? selectedItem.customer_name : selectedItem.supplier_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                      Due Back Date
                    </p>
                    <p className="text-sm text-stone-900">
                      {selectedItem.due_back_date
                        ? format(new Date(selectedItem.due_back_date), "dd MMMM yyyy")
                        : "No date set"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedItem.notes && (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-stone-700 leading-relaxed">{selectedItem.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-5 border-t border-stone-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickStatus(selectedItem.id, "returned")}
                  className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:border-stone-300 hover:text-stone-900 transition-all duration-200"
                >
                  Return
                </button>
                <button
                  onClick={() => handleQuickStatus(selectedItem.id, "sold")}
                  className="nx-btn-primary inline-flex items-center justify-center"
                >
                  Mark as Sold
                </button>
              </div>
              <button
                disabled
                title="Coming soon — conversion to owned stock in a future release"
                className="w-full px-4 py-2.5 text-stone-400 rounded-lg text-xs font-medium uppercase tracking-luxury cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                Convert to Owned Stock
                <span className="text-[10px] text-stone-400 normal-case tracking-normal">(coming soon)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900">
                New {tab === "memo" ? "Memo" : "Consignment"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="item_name"
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Value ($)
                  </label>
                  <input
                    name="retail_value"
                    type="number"
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Commission %
                  </label>
                  <input
                    name="commission_rate"
                    type="number"
                    defaultValue="20"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Contact
                  </label>
                  <select
                    name={tab === "memo" ? "customer_id" : "supplier_id"}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  >
                    {tab === "memo"
                      ? customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.first_name} {c.last_name}
                          </option>
                        ))
                      : suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Saving..." : "Create Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
