"use client";

import { useState, useTransition } from "react";
import {
  getRevenueByDateRange,
  getRepairStats,
  getBespokeStats,
  getExpenseSummary,
  exportReportCSV,
  getSupplierPerformance,
  getPaymentStatusOverview,
} from "./actions";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  BanknotesIcon,
  TruckIcon,
  CreditCardIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type Preset = "7d" | "30d" | "3m" | "12m" | "custom";

interface RevenueData {
  total: number;
  totalCost: number;
  count: number;
  byMonth: { month: string; total: number }[];
}

interface RepairData {
  total: number;
  completed: number;
  revenue: number;
  avgDays: number;
}

interface BespokeData {
  total: number;
  completed: number;
  avgValue: number;
}

interface ExpenseRow {
  category: string;
  total: number;
}

interface SupplierRow {
  supplier: string;
  total: number;
  orderCount: number;
}

interface PaymentOverview {
  totalInvoices: number;
  totalAmount: number;
  paid: number;
  paidAmount: number;
  unpaid: number;
  unpaidAmount: number;
  overdue: number;
  overdueAmount: number;
  overdueList: Array<{ id: string; invoice_number: string; customer_name: string | null; total: number; due_date: string | null }>;
}

interface Props {
  /**
   * Historically this component received the tenantId and passed it to the
   * reports server actions. After PR-01 (W4-XTENANT1) those actions resolve
   * the tenant from the session themselves; the prop is retained for
   * backwards compat with the page entry point but intentionally unused.
   */
  tenantId?: string;
  canViewMargins: boolean;
}

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let from = to;

  if (preset === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().split("T")[0];
  } else if (preset === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    from = d.toISOString().split("T")[0];
  } else if (preset === "3m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    from = d.toISOString().split("T")[0];
  } else if (preset === "12m") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    from = d.toISOString().split("T")[0];
  }

  return { from, to };
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(n);
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadExcel(data: Record<string, unknown>[], sheetName: string, filename: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length > 0) {
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map(key => ({ header: key, key, width: 20 }));

    // Add rows
    for (const row of data) {
      worksheet.addRow(row);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsDateClient({ canViewMargins }: Props) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [repairs, setRepairs] = useState<RepairData | null>(null);
  const [bespoke, setBespoke] = useState<BespokeData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [paymentOverview, setPaymentOverview] = useState<PaymentOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getDateRange() {
    if (preset === "custom") {
      return { from: customFrom, to: customTo };
    }
    return getPresetRange(preset);
  }

  function handleLoad() {
    const { from, to } = getDateRange();
    if (!from || !to) { setError("Please set date range"); return; }

    startTransition(async () => {
      setError(null);
      const [revResult, repResult, besResult, expResult, suppResult, payResult] = await Promise.all([
        getRevenueByDateRange(from, to),
        getRepairStats(from, to),
        getBespokeStats(from, to),
        getExpenseSummary(from, to),
        getSupplierPerformance(from, to),
        getPaymentStatusOverview(from, to),
      ]);
      setRevenue(revResult.data);
      setRepairs(repResult.data);
      setBespoke(besResult.data);
      setExpenses(expResult.data);
      setSuppliers(suppResult.data);
      setPaymentOverview(payResult.data);
      setLoaded(true);
    });
  }

  async function handleExport(reportType: string) {
    const { from, to } = getDateRange();
    const result = await exportReportCSV(reportType, from, to);
    if (result.csv) {
      downloadCSV(result.csv, `${reportType}-${from}-to-${to}.csv`);
    }
  }

  const PRESETS: { id: Preset; label: string }[] = [
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "3m", label: "Last 3 months" },
    { id: "12m", label: "Last 12 months" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Insights
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Track revenue, performance, and customer trends across any date range.
          </p>
        </div>

        {/* Date Range Picker */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
          <div className="flex items-center gap-3 mb-5">
            <CalendarDaysIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            <h2 className="font-serif text-xl text-stone-900 tracking-tight">Date Range</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  preset === p.id
                    ? "bg-stone-900 text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleLoad}
            disabled={isPending}
            className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Loading…" : "Load Reports"}
          </button>
        </div>

        {loaded && (
          <div className="space-y-8">
            {/* Revenue */}
            {revenue && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <ArrowTrendingUpIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                    <h2 className="font-serif text-xl text-stone-900 tracking-tight">Revenue</h2>
                  </div>
                  <button
                    onClick={() => handleExport("revenue")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                <div className={`grid ${canViewMargins ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"} gap-y-6 gap-x-6 sm:divide-x sm:divide-stone-200`}>
                  <div className="sm:px-6 sm:first:pl-0">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Total Revenue
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {fmtCurrency(revenue.total)}
                    </p>
                  </div>
                  <div className="sm:px-6">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Invoices Paid
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {revenue.count}
                    </p>
                  </div>
                  {canViewMargins && (
                    <>
                      <div className="sm:px-6">
                        <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                          Gross Profit
                        </p>
                        <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                          {fmtCurrency(revenue.total - revenue.totalCost)}
                        </p>
                      </div>
                      <div className="sm:px-6 sm:last:pr-0">
                        <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                          Margin
                        </p>
                        <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                          {(((revenue.total - revenue.totalCost) / (revenue.total || 1)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {revenue.byMonth.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-stone-200">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-4">
                      Monthly Breakdown
                    </p>
                    <div className="space-y-2.5">
                      {revenue.byMonth.map((m) => (
                        <div key={m.month} className="flex items-center gap-4">
                          <span className="text-xs text-stone-500 w-16 tabular-nums">{m.month}</span>
                          <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-nexpura-bronze h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (m.total / (revenue.total || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-stone-700 w-24 text-right tabular-nums">
                            {fmtCurrency(m.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Repairs */}
            {repairs && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <WrenchScrewdriverIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                    <h2 className="font-serif text-xl text-stone-900 tracking-tight">Repair Performance</h2>
                  </div>
                  <button
                    onClick={() => handleExport("repairs")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-6 sm:divide-x sm:divide-stone-200">
                  <div className="sm:px-6 sm:first:pl-0">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Total Repairs
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {repairs.total}
                    </p>
                  </div>
                  <div className="sm:px-6">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Completed
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                      {repairs.completed}
                    </p>
                  </div>
                  <div className="sm:px-6">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Revenue
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {fmtCurrency(repairs.revenue)}
                    </p>
                  </div>
                  <div className="sm:px-6 sm:last:pr-0">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Avg Turnaround
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {repairs.avgDays}d
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bespoke */}
            {bespoke && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
                <div className="flex items-center gap-3 mb-6">
                  <SparklesIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                  <h2 className="font-serif text-xl text-stone-900 tracking-tight">Bespoke Performance</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-6 gap-x-6 sm:divide-x sm:divide-stone-200">
                  <div className="sm:px-6 sm:first:pl-0">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Total Jobs
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {bespoke.total}
                    </p>
                  </div>
                  <div className="sm:px-6">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Completed
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                      {bespoke.completed}
                    </p>
                  </div>
                  <div className="sm:px-6 sm:last:pr-0">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Avg Value
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {fmtCurrency(bespoke.avgValue)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Expenses */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BanknotesIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                  <h2 className="font-serif text-xl text-stone-900 tracking-tight">Expense Summary</h2>
                </div>
                <button
                  onClick={() => handleExport("expenses")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                >
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
              {expenses.length === 0 ? (
                <p className="text-sm text-stone-500">No expenses in this period</p>
              ) : (
                <div className="space-y-1">
                  {expenses.map((e) => (
                    <div key={e.category} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                      <span className="text-sm text-stone-700">{e.category}</span>
                      <span className="text-sm font-semibold text-stone-900 tabular-nums">{fmtCurrency(e.total)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Total</span>
                    <span className="font-serif text-2xl tracking-tight tabular-nums text-stone-900">
                      {fmtCurrency(expenses.reduce((s, e) => s + e.total, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Supplier Performance */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
              <div className="flex items-center gap-3 mb-6">
                <TruckIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                <h2 className="font-serif text-xl text-stone-900 tracking-tight">Supplier Performance</h2>
              </div>
              {suppliers.length === 0 ? (
                <p className="text-sm text-stone-500">No purchase orders in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-3 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Supplier</th>
                        <th className="text-right py-3 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Orders</th>
                        <th className="text-right py-3 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {suppliers.map((s) => (
                        <tr key={s.supplier}>
                          <td className="py-3 font-medium text-stone-900">{s.supplier}</td>
                          <td className="py-3 text-right text-stone-600 tabular-nums">{s.orderCount}</td>
                          <td className="py-3 text-right font-semibold text-stone-900 tabular-nums">{fmtCurrency(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Status Overview */}
            {paymentOverview && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-400">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCardIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                  <h2 className="font-serif text-xl text-stone-900 tracking-tight">Payment Status Overview</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-6 sm:divide-x sm:divide-stone-200 mb-6">
                  <div className="sm:px-6 sm:first:pl-0">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3">
                      Total Invoices
                    </p>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-stone-900">
                      {paymentOverview.totalInvoices}
                    </p>
                    <p className="text-xs text-stone-500 mt-2 tabular-nums">{fmtCurrency(paymentOverview.totalAmount)}</p>
                  </div>
                  <div className="sm:px-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-nexpura-emerald-deep" strokeWidth={2} />
                      <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Paid</p>
                    </div>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-emerald-deep">
                      {paymentOverview.paid}
                    </p>
                    <p className="text-xs text-stone-500 mt-2 tabular-nums">{fmtCurrency(paymentOverview.paidAmount)}</p>
                  </div>
                  <div className="sm:px-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <ClockIcon className="w-3.5 h-3.5 text-nexpura-bronze" strokeWidth={2} />
                      <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Unpaid</p>
                    </div>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-bronze">
                      {paymentOverview.unpaid}
                    </p>
                    <p className="text-xs text-stone-500 mt-2 tabular-nums">{fmtCurrency(paymentOverview.unpaidAmount)}</p>
                  </div>
                  <div className="sm:px-6 sm:last:pr-0">
                    <div className="flex items-center gap-1.5 mb-3">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 text-nexpura-oxblood" strokeWidth={2} />
                      <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">Overdue</p>
                    </div>
                    <p className="font-serif text-4xl leading-none tracking-tight tabular-nums text-nexpura-oxblood">
                      {paymentOverview.overdue}
                    </p>
                    <p className="text-xs text-stone-500 mt-2 tabular-nums">{fmtCurrency(paymentOverview.overdueAmount)}</p>
                  </div>
                </div>
                {paymentOverview.overdueList.length > 0 && (
                  <div className="pt-6 border-t border-stone-200">
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-4">
                      Overdue Invoices
                    </p>
                    <div className="space-y-1">
                      {paymentOverview.overdueList.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                          <div>
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="text-sm font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                            >
                              {inv.invoice_number}
                            </Link>
                            <span className="text-xs text-stone-500 ml-2">{inv.customer_name || "—"}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-stone-900 tabular-nums">{fmtCurrency(inv.total)}</p>
                            <p className="text-xs text-nexpura-oxblood">Due {inv.due_date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
