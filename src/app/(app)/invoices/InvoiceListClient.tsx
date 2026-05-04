"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  PlusIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
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
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12 px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
      <div className="max-w-[1400px] mx-auto">
        {/* Header (skipped when the server shell renders it above) */}
        {!hideTitleBlock && (
          <div className="mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Sales
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-900 leading-[1.05] tracking-tight">
                {overdueOnly ? "Overdue Invoices" : "Invoices"}
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                {overdueOnly
                  ? "Track and follow up on invoices past their due date."
                  : "Issue, track, and reconcile your customer invoices."}
              </p>
            </div>
            <Link
              href="/invoices/new"
              className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              New Invoice
            </Link>
          </div>
        )}

        {/* Stats — rendered as a clean horizontal strip rather than boxed
            cards. The landing page treats metrics as bare typography over
            ivory; we mirror that here. Big serif figures, hairline dividers
            between cells on lg+, and only one tasteful semantic accent
            (oxblood for overdue when > 0; emerald-deep for paid this month).
            Section 8.2 (overdueOnly) keeps a 5-cell strip; default is 3-cell. */}
        {overdueOnly && overdueStats ? (
          <div className="mb-14 grid grid-cols-2 lg:grid-cols-5 gap-y-8 gap-x-6 lg:divide-x lg:divide-stone-200">
            <div className="lg:px-8 lg:first:pl-0">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Total Overdue
              </p>
              <p
                className={`font-serif text-4xl leading-none tracking-tight tabular-nums ${
                  overdueStats.totalOverdue > 0
                    ? "text-nexpura-oxblood"
                    : "text-stone-900"
                }`}
              >
                {fmt(overdueStats.totalOverdue)}
              </p>
            </div>
            <div className="lg:px-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Number Overdue
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                {overdueStats.numberOverdue}
              </p>
            </div>
            <div className="lg:px-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Avg Days Overdue
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                {overdueStats.avgDaysOverdue}
              </p>
            </div>
            <div className="lg:px-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Highest Overdue
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                {fmt(overdueStats.highestOverdue)}
              </p>
            </div>
            <div className="lg:px-8 lg:last:pr-0">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Paid This Month
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                {fmt(overdueStats.paidThisMonth)}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-y-8 gap-x-6 sm:divide-x sm:divide-stone-200">
            <div className="sm:px-8 sm:first:pl-0">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Total Outstanding
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                {fmt(stats.totalOutstanding)}
              </p>
            </div>
            <div className="sm:px-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Overdue
              </p>
              <p
                className={`font-serif text-4xl leading-none tracking-tight tabular-nums ${
                  stats.totalOverdue > 0
                    ? "text-nexpura-oxblood"
                    : "text-stone-900"
                }`}
              >
                {fmt(stats.totalOverdue)}
              </p>
            </div>
            <div className="sm:px-8 sm:last:pr-0">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                Paid This Month
              </p>
              <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                {fmt(stats.paidThisMonth)}
              </p>
            </div>
          </div>
        )}

        {/* Search + Tabs */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-stone-200">
            <div className="relative max-w-md">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4 pointer-events-none" />
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
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1.5 px-5 py-3 border-b border-stone-200 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const isActive =
                activeStatus === tab.key || (tab.key === "all" && activeStatus === "all");
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key === "all" ? "" : tab.key)}
                  className={`px-3.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Table */}
          {visibleInvoices.length === 0 ? (
            overdueOnly ? (
              <div className="py-20 text-center px-6">
                <CheckCircleIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl text-stone-900 mb-3">No overdue invoices</h3>
                <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed mb-7">
                  Every invoice is paid or still within its due date.
                </p>
                <Link
                  href="/invoices/new"
                  className="nx-btn-primary inline-flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create invoice
                </Link>
              </div>
            ) : (
              <div className="py-20 text-center px-6">
                <DocumentTextIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" strokeWidth={1.5} />
                <h3 className="font-serif text-2xl text-stone-900 mb-3">No invoices found</h3>
                <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed mb-7">
                  {q ? "Try adjusting your search." : "Create your first invoice to get started."}
                </p>
                {!q && (
                  <Link
                    href="/invoices/new"
                    className="nx-btn-primary inline-flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
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
                    <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Invoice #
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Customer
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Date
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Due Date
                    </th>
                    <th className="text-right px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Total
                    </th>
                    <th className="text-right px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Amount Due
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-stone-400 text-[0.6875rem] uppercase tracking-luxury">
                      Status
                    </th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibleInvoices.map((inv) => {
                    const isOverdue =
                      inv.due_date &&
                      new Date(inv.due_date) < new Date() &&
                      !["paid", "voided"].includes(inv.status);
                    // Surface overdue rows visually even if their literal
                    // status is still "unpaid"/"partial" — match the
                    // server-side overdue predicate.
                    const displayStatus =
                      isOverdue &&
                      !["overdue", "paid", "voided", "draft", "cancelled"].includes(inv.status)
                        ? "overdue"
                        : inv.status;
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-stone-50/60 transition-colors duration-200 group"
                      >
                        <td className="px-5 py-4 font-medium text-stone-900">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="hover:text-nexpura-bronze transition-colors duration-200"
                          >
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-stone-700">
                          {inv.customers?.full_name || "—"}
                        </td>
                        <td className="px-5 py-4 text-stone-500 tabular-nums">
                          {fmtDate(inv.invoice_date)}
                        </td>
                        <td
                          className={`px-5 py-4 tabular-nums ${
                            isOverdue ? "text-nexpura-oxblood font-medium" : "text-stone-500"
                          }`}
                        >
                          {fmtDate(inv.due_date)}
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-stone-900 tabular-nums">
                          {fmt(inv.total)}
                        </td>
                        <td
                          className={`px-5 py-4 text-right font-medium tabular-nums ${
                            inv.amount_due > 0 ? "text-stone-900" : "text-stone-400"
                          }`}
                        >
                          {fmt(inv.amount_due)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={displayStatus} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() =>
                                window.open(`/api/invoice/${inv.id}/pdf`, "_blank")
                              }
                              title="Download PDF"
                              className="inline-flex items-center justify-center rounded-md h-8 w-8 text-stone-400 hover:text-nexpura-bronze hover:bg-stone-100 transition-colors duration-200"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" />
                            </button>
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="inline-flex items-center justify-center rounded-md h-8 w-8 text-stone-400 hover:text-nexpura-bronze hover:bg-stone-100 transition-colors duration-200"
                            >
                              <ChevronRightIcon className="w-4 h-4" />
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
            <div className="flex items-center justify-between px-5 py-4 border-t border-stone-200">
              <p className="text-sm text-stone-500 tabular-nums">
                {visibleInvoices.length === invoices.length
                  ? `Showing ${invoices.length} of ${totalCount} invoices`
                  : `Showing ${visibleInvoices.length} of ${invoices.length} loaded (${totalCount} total)`}
              </p>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => navigate({ page: String(page - 1) })}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-stone-200"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => navigate({ page: String(page + 1) })}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-stone-200"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
