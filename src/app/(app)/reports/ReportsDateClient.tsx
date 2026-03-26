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
  tenantId: string;
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

export default function ReportsDateClient({ tenantId, canViewMargins }: Props) {
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
        getRevenueByDateRange(tenantId, from, to),
        getRepairStats(tenantId, from, to),
        getBespokeStats(tenantId, from, to),
        getExpenseSummary(tenantId, from, to),
        getSupplierPerformance(tenantId, from, to),
        getPaymentStatusOverview(tenantId, from, to),
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
    const result = await exportReportCSV(tenantId, reportType, from, to);
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
    <div className="space-y-6 mt-6">
      {/* Date Range Picker */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4">Date Range</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.id
                  ? "bg-amber-700 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-3 mb-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">From</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">To</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleLoad}
          disabled={isPending}
          className="px-6 py-2.5 bg-amber-700 text-white rounded-xl font-medium text-sm hover:bg-[#7a6447] transition-colors disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load Reports"}
        </button>
      </div>

      {loaded && (
        <>
          {/* Revenue */}
          {revenue && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-900">Revenue</h2>
                <button onClick={() => handleExport("revenue")} className="text-xs text-amber-700 hover:underline">Export CSV</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-stone-900">{fmtCurrency(revenue.total)}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Invoices Paid</p>
                  <p className="text-2xl font-bold text-stone-900">{revenue.count}</p>
                </div>
                {canViewMargins && (
                  <>
                    <div className="bg-stone-50 rounded-xl p-4">
                      <p className="text-xs text-stone-500 mb-1">Gross Profit</p>
                      <p className="text-2xl font-bold text-amber-700">{fmtCurrency(revenue.total - revenue.totalCost)}</p>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-4">
                      <p className="text-xs text-stone-500 mb-1">Margin %</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {(((revenue.total - revenue.totalCost) / (revenue.total || 1)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </>
                )}
              </div>
              {revenue.byMonth.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wider">Monthly Breakdown</p>
                  <div className="space-y-2">
                    {revenue.byMonth.map((m) => (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="text-xs text-stone-500 w-16">{m.month}</span>
                        <div className="flex-1 bg-stone-100 rounded-full h-2">
                          <div
                            className="bg-amber-700 h-2 rounded-full"
                            style={{ width: `${Math.min(100, (m.total / (revenue.total || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-stone-700 w-24 text-right">{fmtCurrency(m.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Repairs */}
          {repairs && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-900">Repair Performance</h2>
                <button onClick={() => handleExport("repairs")} className="text-xs text-amber-700 hover:underline">Export CSV</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Total Repairs</p>
                  <p className="text-2xl font-bold text-stone-900">{repairs.total}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-700">{repairs.completed}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Revenue</p>
                  <p className="text-2xl font-bold text-stone-900">{fmtCurrency(repairs.revenue)}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Avg Turnaround</p>
                  <p className="text-2xl font-bold text-stone-900">{repairs.avgDays}d</p>
                </div>
              </div>
            </div>
          )}

          {/* Bespoke */}
          {bespoke && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-stone-900 mb-4">Bespoke Performance</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Total Jobs</p>
                  <p className="text-2xl font-bold text-stone-900">{bespoke.total}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-700">{bespoke.completed}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Avg Value</p>
                  <p className="text-2xl font-bold text-stone-900">{fmtCurrency(bespoke.avgValue)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Expenses */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900">Expense Summary</h2>
              <button onClick={() => handleExport("expenses")} className="text-xs text-amber-700 hover:underline">Export CSV</button>
            </div>
            {expenses.length === 0 ? (
              <p className="text-sm text-stone-400">No expenses in this period</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((e) => (
                  <div key={e.category} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                    <span className="text-sm text-stone-700">{e.category}</span>
                    <span className="text-sm font-semibold text-stone-900">{fmtCurrency(e.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 font-semibold">
                  <span className="text-sm text-stone-900">Total</span>
                  <span className="text-sm text-stone-900">{fmtCurrency(expenses.reduce((s, e) => s + e.total, 0))}</span>
                </div>
              </div>
            )}
          </div>

          {/* Supplier Performance */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-stone-900 mb-4">Supplier Performance</h2>
            {suppliers.length === 0 ? (
              <p className="text-sm text-stone-400">No purchase orders in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left py-2 text-xs font-medium text-stone-500 uppercase tracking-wide">Supplier</th>
                      <th className="text-right py-2 text-xs font-medium text-stone-500 uppercase tracking-wide">Orders</th>
                      <th className="text-right py-2 text-xs font-medium text-stone-500 uppercase tracking-wide">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {suppliers.map((s) => (
                      <tr key={s.supplier}>
                        <td className="py-2.5 font-medium text-stone-900">{s.supplier}</td>
                        <td className="py-2.5 text-right text-stone-600">{s.orderCount}</td>
                        <td className="py-2.5 text-right font-semibold text-stone-900">{fmtCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment Status Overview */}
          {paymentOverview && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-stone-900 mb-4">Payment Status Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-500 mb-1">Total Invoices</p>
                  <p className="text-2xl font-bold text-stone-900">{paymentOverview.totalInvoices}</p>
                  <p className="text-xs text-stone-500 mt-1">{fmtCurrency(paymentOverview.totalAmount)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-600 mb-1">Paid</p>
                  <p className="text-2xl font-bold text-green-700">{paymentOverview.paid}</p>
                  <p className="text-xs text-green-600 mt-1">{fmtCurrency(paymentOverview.paidAmount)}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xs text-amber-600 mb-1">Unpaid</p>
                  <p className="text-2xl font-bold text-amber-700">{paymentOverview.unpaid}</p>
                  <p className="text-xs text-amber-600 mt-1">{fmtCurrency(paymentOverview.unpaidAmount)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs text-red-600 mb-1">Overdue</p>
                  <p className="text-2xl font-bold text-red-700">{paymentOverview.overdue}</p>
                  <p className="text-xs text-red-600 mt-1">{fmtCurrency(paymentOverview.overdueAmount)}</p>
                </div>
              </div>
              {paymentOverview.overdueList.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Overdue Invoices</p>
                  <div className="space-y-2">
                    {paymentOverview.overdueList.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                        <div>
                          <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-amber-700 hover:underline">
                            {inv.invoice_number}
                          </Link>
                          <span className="text-xs text-stone-500 ml-2">{inv.customer_name || "—"}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-stone-900">{fmtCurrency(inv.total)}</p>
                          <p className="text-xs text-red-500">Due {inv.due_date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
