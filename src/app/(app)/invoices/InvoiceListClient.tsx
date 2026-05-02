"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CheckCircle, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
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
  overdueStats?: {
    totalOverdue: number;
    numberOverdue: number;
    avgDaysOverdue: number;
    highestOverdue: number;
    paidThisMonth: number;
  };
  overdueOnly?: boolean;
  /**
   * Set true when the page's server shell renders its own title + New
   * Invoice button above the Suspense boundary — avoids a duplicate H1
   * flash when the list streams in.
   */
  hideTitleBlock?: boolean;
}

export default function InvoiceListClient({
  invoices,
  totalCount,
  page,
  totalPages,
  q,
  statusFilter: initialStatusFilter,
  stats,
  overdueStats,
  overdueOnly = false,
  hideTitleBlock = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Status tab filtering is client-side now — same pattern as /repairs and
  // /bespoke. Every tab click used to trigger a full RSC round-trip to
  // re-query the same invoices with a different `.eq("status", …)`. With
  // 200 rows loaded, filtering them via useMemo is ~1ms and instant.
  const [activeStatus, setActiveStatus] = useState(initialStatusFilter || "all");

  // "overdue" is a computed status, not a literal status value. Mirror the
  // same predicate the server query used to apply:
  //   status NOT IN (paid, voided, draft, cancelled) AND due_date < today
  const todayStr = new Date().toISOString().split("T")[0];
  const visibleInvoices = useMemo(() => {
    if (activeStatus === "all") return invoices;
    if (activeStatus === "overdue") {
      return invoices.filter(
        (inv) =>
          !["paid", "voided", "draft", "cancelled"].includes(inv.status) &&
          inv.due_date !== null &&
          inv.due_date < todayStr
      );
    }
    return invoices.filter((inv) => inv.status === activeStatus);
  }, [invoices, activeStatus, todayStr]);

  // Status tab click: instant local-state filter + shallow URL sync so refresh
  // and share-links still land on the right tab. No router.push, no RSC fetch.
  const setStatus = useCallback(
    (status: string) => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (status && status !== "all") sp.set("status", status);
      const nextUrl = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
      setActiveStatus(status || "all");
      if (typeof window !== "undefined") window.history.replaceState(null, "", nextUrl);
    },
    [q, pathname]
  );

  // Search + pagination still go through the router — server handles the
  // ILIKE search (which may need to look past the 200-most-recent cap) and
  // serves older pages for tenants with >200 invoices.
  const navigate = useCallback(
    (newParams: Record<string, string>) => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (activeStatus && activeStatus !== "all") sp.set("status", activeStatus);
      sp.set("page", "1");
      Object.entries(newParams).forEach(([k, v]) => {
        if (v) sp.set(k, v);
        else sp.delete(k);
      });
      router.push(`${pathname}?${sp.toString()}`);
    },
    [q, activeStatus, pathname, router]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header (skipped when the server shell renders it above) */}
      {!hideTitleBlock && (
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
      )}

      {/* Stats — overdue-only mode (Section 8.2) renders a 5-card strip
          with oxblood total/avg-days plus an emerald "paid this month"
          counterweight. Default mode keeps the existing 3-card layout. */}
      {overdueOnly && overdueStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-nexpura-charcoal-500 uppercase tracking-wider mb-2">
              Total Overdue
            </p>
            <p className="font-semibold text-2xl text-nexpura-oxblood">
              {fmt(overdueStats.totalOverdue)}
            </p>
          </div>
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-nexpura-charcoal-500 uppercase tracking-wider mb-2">
              Number Overdue
            </p>
            <p className="font-semibold text-2xl text-nexpura-charcoal-700">
              {overdueStats.numberOverdue}
            </p>
          </div>
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-nexpura-charcoal-500 uppercase tracking-wider mb-2">
              Avg Days Overdue
            </p>
            <p className="font-semibold text-2xl text-nexpura-charcoal-700">
              {overdueStats.avgDaysOverdue}
            </p>
          </div>
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-nexpura-charcoal-500 uppercase tracking-wider mb-2">
              Highest Overdue
            </p>
            <p className="font-semibold text-2xl text-nexpura-charcoal-700">
              {fmt(overdueStats.highestOverdue)}
            </p>
          </div>
          <div className="bg-nexpura-ivory-elevated rounded-xl border border-nexpura-taupe-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-nexpura-charcoal-500 uppercase tracking-wider mb-2">
              Paid This Month
            </p>
            <p className="font-semibold text-2xl text-nexpura-emerald-deep">
              {fmt(overdueStats.paidThisMonth)}
            </p>
          </div>
        </div>
      ) : (
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
            <p className={`font-semibold text-2xl font-semibold ${stats.totalOverdue > 0 ? "text-nexpura-oxblood" : "text-stone-900"}`}>
              {fmt(stats.totalOverdue)}
            </p>
            <p className="text-xs text-stone-400 mt-1">Past due date</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Paid This Month
            </p>
            <p className="font-semibold text-2xl font-semibold text-nexpura-emerald-deep">
              {fmt(stats.paidThisMonth)}
            </p>
            <p className="text-xs text-stone-400 mt-1">Payments received</p>
          </div>
        </div>
      )}

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
              if (activeStatus && activeStatus !== "all") sp.set("status", activeStatus);
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
              onClick={() => setStatus(tab.key === "all" ? "" : tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeStatus === tab.key || (tab.key === "all" && activeStatus === "all")
                  ? "bg-amber-700 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-900/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {visibleInvoices.length === 0 ? (
          overdueOnly ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-nexpura-emerald-bg rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-nexpura-emerald-deep" />
              </div>
              <p className="font-semibold text-lg text-nexpura-charcoal-700">No overdue invoices</p>
              <p className="text-sm text-nexpura-charcoal-500 mt-1">
                Every invoice is paid or still within its due date.
              </p>
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-nexpura-charcoal text-white rounded-lg text-sm font-medium hover:bg-nexpura-charcoal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create invoice
              </Link>
            </div>
          ) : (
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
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-nexpura-charcoal text-white rounded-lg text-sm font-medium hover:bg-nexpura-charcoal-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Invoice
                </Link>
              )}
            </div>
          )
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
                {visibleInvoices.map((inv) => {
                  const isOverdue =
                    inv.due_date &&
                    new Date(inv.due_date) < new Date() &&
                    !["paid", "voided"].includes(inv.status);
                  // Surface overdue rows visually even if their literal
                  // status is still "unpaid"/"partial" — match the
                  // server-side overdue predicate.
                  const displayStatus = isOverdue && !["overdue", "paid", "voided", "draft", "cancelled"].includes(inv.status)
                    ? "overdue"
                    : inv.status;
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
                        <StatusBadge status={displayStatus} />
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

        {/* Pagination footer — now shows the client-filtered count of visible
            invoices on the current page, and hides Prev/Next unless there's
            an older/newer page of 200 to fetch server-side. */}
        {(totalPages > 1 || visibleInvoices.length !== invoices.length) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200">
            <p className="text-sm text-stone-500">
              {visibleInvoices.length === invoices.length
                ? `Showing ${invoices.length} of ${totalCount} invoices`
                : `Showing ${visibleInvoices.length} of ${invoices.length} loaded (${totalCount} total)`}
            </p>
            {totalPages > 1 && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
