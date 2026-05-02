"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { arrayToCSV } from "@/lib/export";

const CATEGORIES = ["stock", "rent", "utilities", "marketing", "staffing", "equipment", "repairs", "other"];

const CATEGORY_LABELS: Record<string, string> = {
  stock: "Stock / Inventory",
  rent: "Rent",
  utilities: "Utilities",
  marketing: "Marketing",
  staffing: "Staffing",
  equipment: "Equipment",
  repairs: "Repairs",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  stock: "bg-amber-500",
  rent: "bg-amber-500",
  utilities: "bg-stone-500",
  marketing: "bg-stone-1000",
  staffing: "bg-rose-500",
  equipment: "bg-orange-500",
  repairs: "bg-stone-500",
  other: "bg-gray-400",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  invoice_ref: string | null;
  expense_date: string;
}

export default function ExpenseReportsPage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(lastOfMonth);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/expenses?from=${dateFrom}&to=${dateTo}&category=${categoryFilter}`)
      .then((r) => r.json())
      .then((data) => {
        setExpenses(data.expenses ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dateFrom, dateTo, categoryFilter]);

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Category breakdown
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.amount || 0);
  }
  const maxCat = Math.max(...Object.values(byCategory), 1);

  function handleCSVDownload() {
    // W6-HIGH-05 / W4-REPORT8: arrayToCSV now prefixes formula
    // triggers (=, +, -, @, \t, \r) with an apostrophe before
    // RFC-4180 quoting, so an expense description starting with `=`
    // can't execute as an Excel formula.
    const csv = arrayToCSV(
      expenses.map((e) => ({
        date: e.expense_date,
        description: e.description,
        category: CATEGORY_LABELS[e.category] ?? e.category,
        amount: e.amount.toFixed(2),
        invoice_ref: e.invoice_ref ?? "",
      })),
      [
        { key: "date", label: "Date" },
        { key: "description", label: "Description" },
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount" },
        { key: "invoice_ref", label: "Invoice Ref" },
      ],
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-stone-400 mb-1">
            <Link href="/reports" className="hover:text-amber-700">Reports</Link>
            <span>/</span>
            <span className="text-stone-600">Expenses</span>
          </div>
          <h1 className="font-semibold text-2xl text-stone-900">Expense Reports</h1>
          <p className="text-stone-500 mt-1 text-sm">Filter, analyse, and export your business expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCSVDownload}
            className="inline-flex items-center gap-1.5 h-9 px-3 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <Link href="/expenses/new" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700 transition-colors">
            + Add Expense
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-4 shadow-sm">
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze" />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze" />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-nexpura-bronze">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-stone-500 font-medium">Total</p>
          <p className="text-xl font-semibold text-stone-900">{fmtCurrency(total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-stone-900">By Category</h2>
          {Object.keys(byCategory).length === 0 ? (
            <p className="text-sm text-stone-400">No expenses in this period</p>
          ) : (
            <div className="space-y-3">
              {CATEGORIES.filter((c) => byCategory[c] > 0).map((cat) => {
                const pct = Math.round((byCategory[cat] / maxCat) * 100);
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs text-stone-600 mb-1">
                      <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                      <span>{fmtCurrency(byCategory[cat])}</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${CATEGORY_COLORS[cat] || "bg-stone-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expense Table */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Expense Lines ({expenses.length})</h2>
            <span className="text-sm text-stone-500 font-medium">{fmtCurrency(total)}</span>
          </div>
          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-stone-400">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-stone-400">
              No expenses found for this period.{" "}
              <Link href="/expenses/new" className="text-amber-700 hover:underline">Add one →</Link>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-stone-100">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wider">Description</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wider">Category</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-stone-50/50">
                      <td className="px-5 py-3 text-stone-500 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-900 truncate max-w-[200px]">{e.description}</p>
                        {e.invoice_ref && <p className="text-xs text-stone-400">Ref: {e.invoice_ref}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
                          <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[e.category] || "bg-gray-400"}`} />
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-stone-900">{fmtCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-stone-700">Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-stone-900">{fmtCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
