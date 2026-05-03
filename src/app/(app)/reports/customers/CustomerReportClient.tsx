"use client";

import { useState, useMemo } from "react";
import { arrayToCSV } from "@/lib/export";
import { Users, TrendingUp, Heart, ShoppingBag, ArrowDown, ArrowUp } from "lucide-react";

export interface CustomerRow {
  id: string;
  full_name: string;
  email: string | null;
  is_vip: boolean;
  store_credit: number;
  totalSpend: number;
  saleCount: number;
}

type SortKey = "name" | "totalSpend" | "saleCount" | "aov" | "store_credit";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function aov(c: CustomerRow) {
  return c.saleCount > 0 ? c.totalSpend / c.saleCount : 0;
}

export default function CustomerReportClient({
  customers,
}: {
  customers: CustomerRow[];
}) {
  const [view, setView] = useState<"top10" | "all">("top10");
  const [sortKey, setSortKey] = useState<SortKey>("totalSpend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...customers];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "name":
          av = a.full_name?.toLowerCase() ?? "";
          bv = b.full_name?.toLowerCase() ?? "";
          break;
        case "totalSpend":
          av = a.totalSpend;
          bv = b.totalSpend;
          break;
        case "saleCount":
          av = a.saleCount;
          bv = b.saleCount;
          break;
        case "aov":
          av = aov(a);
          bv = aov(b);
          break;
        case "store_credit":
          av = Number(a.store_credit) || 0;
          bv = Number(b.store_credit) || 0;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [customers, sortKey, sortDir]);

  const visible = view === "top10" ? sorted.slice(0, 10) : sorted;

  const totalCustomers = customers.length;
  const vipCount = customers.filter((c) => c.is_vip).length;
  const totalStoreCredit = customers.reduce((sum, c) => sum + (Number(c.store_credit) || 0), 0);
  const avgLifetime = totalCustomers > 0
    ? customers.reduce((sum, c) => sum + c.totalSpend, 0) / totalCustomers
    : 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function handleCSVDownload() {
    const csv = arrayToCSV(
      sorted.map((c) => ({
        name: c.full_name,
        email: c.email ?? "",
        sales: c.saleCount,
        total_spend: c.totalSpend.toFixed(2),
        aov: aov(c).toFixed(2),
        store_credit: (Number(c.store_credit) || 0).toFixed(2),
        status: c.is_vip ? "VIP" : "Standard",
      })),
      [
        { key: "name", label: "Customer" },
        { key: "email", label: "Email" },
        { key: "sales", label: "Orders" },
        { key: "total_spend", label: "Total Spend" },
        { key: "aov", label: "AOV" },
        { key: "store_credit", label: "Store Credit" },
        { key: "status", label: "Status" },
      ],
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().split("T")[0];
    a.download = `customers-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function SortHeader({
    label,
    keyName,
    align = "left",
  }: {
    label: string;
    keyName: SortKey;
    align?: "left" | "right" | "center";
  }) {
    const active = sortKey === keyName;
    const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
    return (
      <th className={`px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-${align}`}>
        <button
          type="button"
          onClick={() => toggleSort(keyName)}
          className={`inline-flex items-center gap-1 ${justify} w-full hover:text-stone-700 transition-colors ${active ? "text-stone-700" : ""}`}
        >
          {label}
          {active && (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-8">
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
          <p className="text-3xl font-bold text-stone-900 mt-1">${fmt(avgLifetime)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="p-2 w-fit rounded-lg bg-stone-100 text-stone-600 mb-4"><ShoppingBag size={20} /></div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Store Credit</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">${fmt(totalStoreCredit)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-stone-900 text-lg">
              {view === "top10" ? "Top 10 Customers" : `All Customers (${totalCustomers})`}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">Click a column header to sort</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-stone-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setView("top10")}
                className={`px-3 h-8 text-xs font-semibold transition-colors ${view === "top10" ? "bg-amber-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Top 10
              </button>
              <button
                type="button"
                onClick={() => setView("all")}
                className={`px-3 h-8 text-xs font-semibold transition-colors border-l border-stone-200 ${view === "all" ? "bg-amber-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                All
              </button>
            </div>
            <button
              type="button"
              onClick={handleCSVDownload}
              disabled={customers.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 border border-stone-200 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <SortHeader label="Customer" keyName="name" align="left" />
                <SortHeader label="Orders" keyName="saleCount" align="right" />
                <SortHeader label="Total Spend" keyName="totalSpend" align="right" />
                <SortHeader label="AOV" keyName="aov" align="right" />
                <SortHeader label="Store Credit" keyName="store_credit" align="right" />
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-12 text-center text-stone-400 italic">No customer data found.</td></tr>
              ) : (
                visible.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-stone-900">{c.full_name}</p>
                      <p className="text-xs text-stone-500">{c.email}</p>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-right text-stone-700">
                      {c.saleCount}
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-right text-stone-900">
                      ${fmt(c.totalSpend)}
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-right text-stone-700">
                      ${fmt(aov(c))}
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-right text-stone-600">
                      ${fmt(Number(c.store_credit) || 0)}
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
