"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { InvoiceRow } from "./page";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "unpaid", label: "Sent" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "voided", label: "Voided" },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-stone-100 text-stone-600 border border-stone-200" },
  // Valid DB status values only
  unpaid: { label: "Sent", className: "bg-stone-100 text-stone-700 border border-stone-200" },
  partial: { label: "Partial", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border border-red-200" },
  voided: { label: "Voided", className: "bg-stone-100 text-stone-400 border border-stone-200" },
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  invoices: InvoiceRow[];
  totalCount: number;
  page: number;
  totalPages: number;
  q: string;
  statusFilter: string;
  stats: {
    totalOutstanding: number;
    totalOverdue: number;
    paidThisMonth: number;
  };
}

export default function InvoiceListClient({
  invoices,
  totalCount,
  page,
  totalPages,
  q,
  statusFilter,
  stats,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = useCallback(
    (newParams: Record<string, string>) => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (statusFilter && statusFilter !== "all") sp.set("status", statusFilter);
      sp.set("page", "1");
      Object.entries(newParams).forEach(([k, v]) => {
        if (v) sp.set(k, v);
        else sp.delete(k);
      });
      router.push(`${pathname}?${sp.toString()}`);
    },
    [q, statusFilter, pathname, router]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Invoices</h1>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Total Outstanding
          </p>
          <p className="font-semibold text-2xl font-semibold text-stone-900">
            {fmt(stats.totalOutstanding)}
          </p>
          <p className="text-xs text-stone-400 mt-1">Sent + partial + overdue</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Overdue
          </p>
          <p className={`font-semibold text-2xl font-semibold ${stats.totalOverdue > 0 ? "text-red-500" : "text-stone-900"}`}>
            {fmt(stats.totalOverdue)}
          </p>
          <p className="text-xs text-stone-400 mt-1">Past due date</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Paid This Month
          </p>
          <p className="font-semibold text-2xl font-semibold text-amber-700">
            {fmt(stats.paidThisMonth)}
          </p>
          <p className="text-xs text-stone-400 mt-1">Payments received</p>
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200">
          <input
            type="text"
            placeholder="Search invoice number or customer…"
            defaultValue={q}
            onChange={(e) => {
              const val = e.target.value;
              const sp = new URLSearchParams();
              if (val) sp.set("q", val);
              if (statusFilter && statusFilter !== "all") sp.set("status", statusFilter);
              router.push(`${pathname}?${sp.toString()}`);
            }}
            className="w-full max-w-md px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 px-4 py-3 border-b border-stone-200 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate({ status: tab.key === "all" ? "" : tab.key })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key || (tab.key === "all" && statusFilter === "all")
                  ? "bg-amber-700 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-900/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {invoices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-lg text-stone-900">No invoices found</p>
            <p className="text-sm text-stone-500 mt-1">
              {q ? "Try adjusting your search" : "Create your first invoice to get started"}
            </p>
            {!q && (
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Invoice
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Amount Due
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum">
                {invoices.map((inv) => {
                  const badge = STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft;
                  const isOverdue =
                    inv.due_date &&
                    new Date(inv.due_date) < new Date() &&
                    !["paid", "voided"].includes(inv.status);
                  return (
                    <tr key={inv.id} className="hover:bg-stone-900/2 transition-colors group">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="hover:text-amber-700 transition-colors"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-900/70">
                        {inv.customers?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-stone-900/70">
                        {fmtDate(inv.invoice_date)}
                      </td>
                      <td className={`px-4 py-3 ${isOverdue ? "text-red-500 font-medium" : "text-stone-900/70"}`}>
                        {fmtDate(inv.due_date)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-stone-900">
                        {fmt(inv.total)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${inv.amount_due > 0 ? "text-stone-900" : "text-stone-400"}`}>
                        {fmt(inv.amount_due)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => window.open(`/api/invoice/${inv.id}/pdf`, "_blank")}
                            title="Download PDF"
                            className="inline-flex items-center justify-center rounded-md h-7 w-7 text-stone-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center justify-center rounded-md h-7 w-7 text-stone-400 hover:text-amber-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200">
            <p className="text-sm text-stone-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
                className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-900 disabled:opacity-30 hover:border-amber-600/40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
                className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-900 disabled:opacity-30 hover:border-amber-600/40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
