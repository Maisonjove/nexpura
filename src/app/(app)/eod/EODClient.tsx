"use client";

import { useState, useTransition, useEffect } from "react";
import { getEODSummary, saveEODReconciliation, EODSummary } from "./actions";
import { useLocation } from "@/contexts/LocationContext";
import { MapPin } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">End of Day</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-stone-500 text-sm">Daily cash and sales reconciliation</p>
            {hasMultipleLocations && currentLocation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                <MapPin size={10} />
                {currentLocation.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => loadDate(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze"
          />
          <div className="flex bg-stone-100 rounded-lg p-1">
            {(["today", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  activeTab === tab ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {tab === "today" ? "Today" : "History"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isSubmitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-green-800 font-medium">
            ✓ Reconciliation submitted on{" "}
            {new Date(summary.existingReconciliation!.submitted_at!).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
            })}
          </p>
        </div>
      )}

      {activeTab === "today" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales breakdown */}
          <div className="lg:col-span-2 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-400 mb-1">Total Revenue</p>
                <p className="text-xl font-bold text-stone-900">{fmtCurrency(summary.totalRevenue)}</p>
              </div>
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-400 mb-1">Transactions</p>
                <p className="text-xl font-bold text-stone-900">{summary.transactionCount}</p>
              </div>
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-400 mb-1">Cash Sales</p>
                <p className="text-xl font-bold text-stone-900">{fmtCurrency(summary.totalSalesCash)}</p>
              </div>
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-400 mb-1">Card Sales</p>
                <p className="text-xl font-bold text-stone-900">{fmtCurrency(summary.totalSalesCard)}</p>
              </div>
            </div>

            {/* Payment method breakdown */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-stone-200">
                <h2 className="text-base font-semibold text-stone-900">Payment Breakdown — {selectedDate}</h2>
              </div>
              <div className="divide-y divide-stone-100">
                {[
                  { label: "Cash", value: summary.totalSalesCash, type: "sales" },
                  { label: "Card / EFTPOS", value: summary.totalSalesCard, type: "sales" },
                  { label: "Bank Transfer", value: summary.totalSalesTransfer, type: "sales" },
                  { label: "Gift Vouchers", value: summary.totalSalesVoucher, type: "sales" },
                  { label: "Layby Payments", value: summary.totalSalesLayby, type: "sales" },
                  { label: "Split / Mixed", value: summary.totalSalesMixed, type: "sales" },
                ].filter((row) => row.value > 0).map((row) => (
                  <div key={row.label} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-stone-700">{row.label}</span>
                    <span className="text-sm font-semibold text-stone-900">{fmtCurrency(row.value)}</span>
                  </div>
                ))}
                {summary.totalRefundsCash > 0 && (
                  <div className="px-5 py-3 flex items-center justify-between bg-red-50/50">
                    <span className="text-sm text-red-600">Cash Refunds</span>
                    <span className="text-sm font-semibold text-red-600">−{fmtCurrency(summary.totalRefundsCash)}</span>
                  </div>
                )}
                {summary.totalRefundsCard > 0 && (
                  <div className="px-5 py-3 flex items-center justify-between bg-red-50/50">
                    <span className="text-sm text-red-600">Card Refunds</span>
                    <span className="text-sm font-semibold text-red-600">−{fmtCurrency(summary.totalRefundsCard)}</span>
                  </div>
                )}
                <div className="px-5 py-4 flex items-center justify-between bg-stone-50">
                  <span className="text-sm font-semibold text-stone-900">Net Revenue</span>
                  <span className="text-base font-bold text-stone-900">{fmtCurrency(summary.totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Cash reconciliation form */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-stone-900">Cash Drawer Reconciliation</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Opening Float</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    disabled={isSubmitted}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze disabled:bg-stone-50 disabled:text-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Cash Expected in Drawer</label>
                  <div className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 text-stone-700 font-semibold">
                    {fmtCurrency(summary.cashExpected)}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">Opening float + cash sales − cash refunds</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Cash Counted *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                    disabled={isSubmitted}
                    placeholder="Count the drawer…"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze disabled:bg-stone-50 disabled:text-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Variance</label>
                  <div className={`border rounded-lg px-3 py-2 text-sm font-semibold ${
                    cashVariance === null ? "border-stone-200 bg-stone-50 text-stone-400"
                    : cashVariance === 0 ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-600"
                  }`}>
                    {cashVariance === null ? "—" : (cashVariance >= 0 ? "+" : "") + fmtCurrency(cashVariance)}
                  </div>
                  {cashVariance !== null && cashVariance !== 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      {cashVariance > 0 ? "Over by" : "Short by"} {fmtCurrency(Math.abs(cashVariance))}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Closing Float</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingFloat}
                  onChange={(e) => setClosingFloat(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="Amount to leave in drawer overnight"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze disabled:bg-stone-50 disabled:text-stone-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="Any discrepancies or notes for the record…"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze resize-none disabled:bg-stone-50 disabled:text-stone-400"
                />
              </div>

              {saveMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg font-medium ${
                  saveMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}>
                  {saveMsg.text}
                </p>
              )}

              {!isSubmitted && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSave(false)}
                    disabled={isPending}
                    className="flex-1 py-2.5 bg-stone-100 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Saving…" : "Save Draft"}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isPending || cashCounted === ""}
                    className="flex-1 py-2.5 bg-nexpura-charcoal text-white text-sm font-semibold rounded-lg hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Submitting…" : "Submit & Close Day"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick tips sidebar */}
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-3">End of Day Checklist</h3>
              <ul className="space-y-2 text-xs text-amber-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">□</span>
                  <span>Count all cash in drawer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">□</span>
                  <span>Reconcile card terminal receipts with card sales total</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">□</span>
                  <span>Check all paid sales have matching invoices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">□</span>
                  <span>Record opening float for tomorrow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">□</span>
                  <span>Note any variances with explanation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">□</span>
                  <span>Submit when complete</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* History tab */
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-stone-200">
            <h2 className="text-base font-semibold text-stone-900">Reconciliation History</h2>
          </div>
          {pastRecords.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-stone-400">
              No past reconciliations found
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60">
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Date</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Revenue</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Transactions</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Cash Variance</th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pastRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-stone-900">
                      {new Date(rec.reconciliation_date).toLocaleDateString("en-AU", {
                        weekday: "short", day: "numeric", month: "short", year: "numeric"
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-stone-900">{fmtCurrency(rec.total_revenue)}</td>
                    <td className="px-4 py-3 text-sm text-right text-stone-500">{rec.transaction_count}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${
                      rec.cash_variance === null ? "text-stone-400"
                      : rec.cash_variance === 0 ? "text-green-600"
                      : "text-red-500"
                    }`}>
                      {rec.cash_variance === null ? "—" :
                        (rec.cash_variance >= 0 ? "+" : "") + fmtCurrency(rec.cash_variance)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                        rec.status === "submitted" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setActiveTab("today"); loadDate(rec.reconciliation_date); }}
                        className="text-xs text-amber-700 hover:text-[#7a6447] font-medium transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
