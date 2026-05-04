"use client";

import { useState, useTransition, useEffect } from "react";
import { getEODSummary, saveEODReconciliation, EODSummary } from "./actions";
import { useLocation } from "@/contexts/LocationContext";
import {
  MapPinIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

interface PastRecord {
  id: string;
  reconciliation_date: string;
  total_revenue: number;
  transaction_count: number;
  cash_variance: number | null;
  status: string;
  submitted_at: string | null;
}

interface Props {
  todaySummary: EODSummary;
  pastRecords: PastRecord[];
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function EODClient({ todaySummary: initialSummary, pastRecords }: Props) {
  const { currentLocationId, currentLocation, hasMultipleLocations } = useLocation();
  const [summary, setSummary] = useState<EODSummary>(initialSummary);
  const [selectedDate, setSelectedDate] = useState(initialSummary.date);
  const [openingFloat, setOpeningFloat] = useState(summary.existingReconciliation?.opening_float?.toString() ?? "0");
  const [cashCounted, setCashCounted] = useState(summary.existingReconciliation?.cash_counted?.toString() ?? "");
  const [closingFloat, setClosingFloat] = useState(summary.existingReconciliation?.closing_float?.toString() ?? "");
  const [notes, setNotes] = useState(summary.existingReconciliation?.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  const cashVariance = cashCounted !== "" ? parseFloat(cashCounted) - summary.cashExpected : null;

  // Reload summary when location changes
  useEffect(() => {
    if (hasMultipleLocations) {
      loadDate(selectedDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocationId]);

  function loadDate(date: string) {
    setSelectedDate(date);
    startTransition(async () => {
      const result = await getEODSummary(date, currentLocationId);
      if (result.data) {
        setSummary(result.data);
        setOpeningFloat(result.data.existingReconciliation?.opening_float?.toString() ?? "0");
        setCashCounted(result.data.existingReconciliation?.cash_counted?.toString() ?? "");
        setClosingFloat(result.data.existingReconciliation?.closing_float?.toString() ?? "");
        setNotes(result.data.existingReconciliation?.notes ?? "");
      }
    });
  }

  function handleSave(submit: boolean) {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await saveEODReconciliation({
        date: selectedDate,
        openingFloat: parseFloat(openingFloat) || 0,
        cashCounted: parseFloat(cashCounted) || 0,
        closingFloat: parseFloat(closingFloat) || 0,
        notes,
        summary,
        submit,
        locationId: currentLocationId,
      });
      if (result.error) {
        setSaveMsg({ type: "err", text: result.error });
      } else {
        setSaveMsg({ type: "ok", text: submit ? "Reconciliation submitted!" : "Saved as draft" });
        // Reload summary to pick up existing record
        const refreshed = await getEODSummary(selectedDate, currentLocationId);
        if (refreshed.data) setSummary(refreshed.data);
      }
    });
  }

  const isSubmitted = summary.existingReconciliation?.status === "submitted";

  const paymentRows = [
    { label: "Cash", value: summary.totalSalesCash },
    { label: "Card / EFTPOS", value: summary.totalSalesCard },
    { label: "Bank Transfer", value: summary.totalSalesTransfer },
    { label: "Gift Vouchers", value: summary.totalSalesVoucher },
    { label: "Layby Payments", value: summary.totalSalesLayby },
    { label: "Split / Mixed", value: summary.totalSalesMixed },
  ].filter((row) => row.value > 0);

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Operations
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
              End of Day
            </h1>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <p className="text-stone-500 leading-relaxed">
                Daily cash and sales reconciliation.
              </p>
              {hasMultipleLocations && currentLocation && (
                <span className="inline-flex items-center gap-1.5 nx-badge-neutral">
                  <MapPinIcon className="w-3 h-3" />
                  {currentLocation.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="relative">
              <CalendarDaysIcon className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => loadDate(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 tabular-nums focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
              />
            </div>
            <div className="flex items-center bg-white border border-stone-200 rounded-full p-1">
              {(["today", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-300 capitalize ${
                    activeTab === tab
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {tab === "today" ? "Today" : "History"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submitted banner */}
        {isSubmitted && (
          <div className="bg-white border border-stone-200 rounded-2xl px-6 py-4 mb-12 flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-stone-700">
              <span className="font-medium text-stone-900">Reconciliation submitted</span>
              {" on "}
              <span className="tabular-nums">
                {new Date(summary.existingReconciliation!.submitted_at!).toLocaleDateString("en-AU", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              </span>
            </p>
          </div>
        )}

        {activeTab === "today" ? (
          <div className="space-y-8 lg:space-y-12">
            {/* Stat Strip */}
            <div className="bg-white border border-stone-200 rounded-2xl">
              <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-stone-200">
                <div className="p-6 lg:p-8 border-b border-stone-200 sm:border-r lg:border-b-0 lg:border-r-0">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                    Total Revenue
                  </p>
                  <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                    {fmtCurrency(summary.totalRevenue)}
                  </p>
                </div>
                <div className="p-6 lg:p-8 border-b border-stone-200 lg:border-b-0">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                    Transactions
                  </p>
                  <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                    {summary.transactionCount}
                  </p>
                </div>
                <div className="p-6 lg:p-8 sm:border-r border-stone-200 lg:border-r-0">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                    Cash Sales
                  </p>
                  <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                    {fmtCurrency(summary.totalSalesCash)}
                  </p>
                </div>
                <div className="p-6 lg:p-8">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                    Card Sales
                  </p>
                  <p className="font-serif text-4xl text-stone-900 tabular-nums tracking-tight">
                    {fmtCurrency(summary.totalSalesCard)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                {/* Payment breakdown */}
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                  <div className="px-6 lg:px-8 py-5 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-luxury text-stone-500 mb-1.5">
                        Today
                      </p>
                      <h2 className="font-serif text-xl text-stone-900 tracking-tight">
                        Payment Breakdown
                      </h2>
                    </div>
                    <span className="text-xs uppercase tracking-luxury text-stone-400 tabular-nums">
                      {selectedDate}
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {paymentRows.length === 0 && summary.totalRefundsCash === 0 && summary.totalRefundsCard === 0 ? (
                      <div className="px-6 lg:px-8 py-14 text-center">
                        <p className="text-sm text-stone-400">No transactions for this date.</p>
                      </div>
                    ) : (
                      <>
                        {paymentRows.map((row) => (
                          <div key={row.label} className="px-6 lg:px-8 py-4 flex items-center justify-between">
                            <span className="text-sm text-stone-700">{row.label}</span>
                            <span className="text-sm font-medium text-stone-900 tabular-nums">
                              {fmtCurrency(row.value)}
                            </span>
                          </div>
                        ))}
                        {summary.totalRefundsCash > 0 && (
                          <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
                            <span className="text-sm text-stone-500">Cash Refunds</span>
                            <span className="text-sm font-medium text-red-600 tabular-nums">
                              −{fmtCurrency(summary.totalRefundsCash)}
                            </span>
                          </div>
                        )}
                        {summary.totalRefundsCard > 0 && (
                          <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
                            <span className="text-sm text-stone-500">Card Refunds</span>
                            <span className="text-sm font-medium text-red-600 tabular-nums">
                              −{fmtCurrency(summary.totalRefundsCard)}
                            </span>
                          </div>
                        )}
                        <div className="px-6 lg:px-8 py-5 flex items-center justify-between bg-stone-50/50">
                          <span className="text-xs uppercase tracking-luxury text-stone-500">
                            Net Revenue
                          </span>
                          <span className="font-serif text-2xl text-stone-900 tabular-nums tracking-tight">
                            {fmtCurrency(summary.totalRevenue)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Cash reconciliation form */}
                <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Reconciliation
                  </p>
                  <h2 className="font-serif text-xl text-stone-900 tracking-tight mb-7">
                    Cash Drawer
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs uppercase tracking-luxury text-stone-500 mb-2">
                        Opening Float
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={openingFloat}
                        onChange={(e) => setOpeningFloat(e.target.value)}
                        disabled={isSubmitted}
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 tabular-nums placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-luxury text-stone-500 mb-2">
                        Cash Expected in Drawer
                      </label>
                      <div className="w-full px-4 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 font-medium tabular-nums">
                        {fmtCurrency(summary.cashExpected)}
                      </div>
                      <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                        Opening float + cash sales − cash refunds
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-luxury text-stone-500 mb-2">
                        Cash Counted <span className="text-stone-400 normal-case">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashCounted}
                        onChange={(e) => setCashCounted(e.target.value)}
                        disabled={isSubmitted}
                        placeholder="Count the drawer…"
                        className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 tabular-nums placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-luxury text-stone-500 mb-2">
                        Variance
                      </label>
                      <div
                        className={`w-full px-4 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-sm font-medium tabular-nums ${
                          cashVariance === null
                            ? "text-stone-400"
                            : cashVariance === 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {cashVariance === null
                          ? "—"
                          : (cashVariance >= 0 ? "+" : "") + fmtCurrency(cashVariance)}
                      </div>
                      {cashVariance !== null && cashVariance !== 0 && (
                        <p className="text-xs text-stone-500 mt-1.5 tabular-nums">
                          {cashVariance > 0 ? "Over by" : "Short by"}{" "}
                          {fmtCurrency(Math.abs(cashVariance))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-xs uppercase tracking-luxury text-stone-500 mb-2">
                      Closing Float
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={closingFloat}
                      onChange={(e) => setClosingFloat(e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Amount to leave in drawer overnight"
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 tabular-nums placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 disabled:bg-stone-50 disabled:text-stone-400"
                    />
                  </div>

                  <div className="mt-5">
                    <label className="block text-xs uppercase tracking-luxury text-stone-500 mb-2">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Any discrepancies or notes for the record…"
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none disabled:bg-stone-50 disabled:text-stone-400"
                    />
                  </div>

                  {saveMsg && (
                    <p
                      className={`mt-5 text-sm ${
                        saveMsg.type === "ok"
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {saveMsg.text}
                    </p>
                  )}

                  {!isSubmitted && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-stone-100">
                      <button
                        onClick={() => handleSave(false)}
                        disabled={isPending}
                        className="flex-1 px-5 py-2.5 rounded-full text-sm font-medium text-stone-700 bg-white border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPending ? "Saving…" : "Save Draft"}
                      </button>
                      <button
                        onClick={() => handleSave(true)}
                        disabled={isPending || cashCounted === ""}
                        className="nx-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPending ? "Submitting…" : "Submit & Close Day"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Checklist
                  </p>
                  <h3 className="font-serif text-lg text-stone-900 tracking-tight mb-5">
                    Closing the Day
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Count all cash in drawer",
                      "Reconcile card terminal receipts with card sales total",
                      "Check all paid sales have matching invoices",
                      "Record opening float for tomorrow",
                      "Note any variances with explanation",
                      "Submit when complete",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-stone-700 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-nexpura-bronze shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* History tab */
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-6 lg:px-8 py-5 border-b border-stone-200">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-1.5">
                Archive
              </p>
              <h2 className="font-serif text-xl text-stone-900 tracking-tight">
                Reconciliation History
              </h2>
              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                Past daily closes and their cash variances.
              </p>
            </div>
            {pastRecords.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <CalendarDaysIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
                <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                  No reconciliations yet
                </h3>
                <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed mb-7">
                  Submitted end-of-day records will appear here for review.
                </p>
                <button
                  onClick={() => setActiveTab("today")}
                  className="nx-btn-primary inline-flex items-center gap-2"
                >
                  Close today
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/50">
                      <th className="text-left text-xs uppercase tracking-luxury text-stone-500 px-6 lg:px-8 py-4 font-medium">
                        Date
                      </th>
                      <th className="text-right text-xs uppercase tracking-luxury text-stone-500 px-4 py-4 font-medium">
                        Revenue
                      </th>
                      <th className="text-right text-xs uppercase tracking-luxury text-stone-500 px-4 py-4 font-medium">
                        Transactions
                      </th>
                      <th className="text-right text-xs uppercase tracking-luxury text-stone-500 px-4 py-4 font-medium">
                        Cash Variance
                      </th>
                      <th className="text-left text-xs uppercase tracking-luxury text-stone-500 px-4 py-4 font-medium">
                        Status
                      </th>
                      <th className="px-4 lg:px-8 py-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {pastRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 lg:px-8 py-4 text-sm text-stone-900 tabular-nums">
                          {new Date(rec.reconciliation_date).toLocaleDateString("en-AU", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-4 text-sm text-right text-stone-900 font-medium tabular-nums">
                          {fmtCurrency(rec.total_revenue)}
                        </td>
                        <td className="px-4 py-4 text-sm text-right text-stone-500 tabular-nums">
                          {rec.transaction_count}
                        </td>
                        <td
                          className={`px-4 py-4 text-sm text-right font-medium tabular-nums ${
                            rec.cash_variance === null
                              ? "text-stone-400"
                              : rec.cash_variance === 0
                              ? "text-emerald-700"
                              : "text-red-600"
                          }`}
                        >
                          {rec.cash_variance === null
                            ? "—"
                            : (rec.cash_variance >= 0 ? "+" : "") + fmtCurrency(rec.cash_variance)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={
                              rec.status === "submitted"
                                ? "nx-badge-success capitalize"
                                : "nx-badge-neutral capitalize"
                            }
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-4 lg:px-8 py-4 text-right">
                          <button
                            onClick={() => {
                              setActiveTab("today");
                              loadDate(rec.reconciliation_date);
                            }}
                            className="text-sm text-nexpura-bronze hover:text-nexpura-bronze-hover font-medium transition-colors duration-200"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
