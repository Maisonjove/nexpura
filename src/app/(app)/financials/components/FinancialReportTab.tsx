'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, Printer, TrendingUp, DollarSign, ReceiptText, CreditCard } from 'lucide-react';
// Lazy-load heavy chart library (recharts) — only loaded when report tab is active
const RevenueChart = dynamic(() => import('../RevenueChart'), { ssr: false });
import StatCard from './StatCard';
import Skeleton from './Skeleton';
import { fmt, fmtFull, todayStr, monthStartStr, PRESETS } from './helpers';
import type { ReportData } from './types';

interface FinancialReportTabProps {
  gstRate: number;
  currency?: string;
}

export default function FinancialReportTab({ gstRate, currency = 'AUD' }: FinancialReportTabProps) {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [activePreset, setActivePreset] = useState('This Month');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchReport = useCallback(async (f: string, t: string) => {
    setLoadingReport(true);
    setReportError(null);
    setAiSummary(null);
    try {
      const res = await fetch(`/api/financials/report?from=${f}&to=${t}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data);
    } catch {
      setReportError('Failed to load report data. Please try again.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => { fetchReport(from, to); }, []); // eslint-disable-line

  const applyPreset = (label: string, fn: () => { from: string; to: string }) => {
    const range = fn();
    setActivePreset(label);
    setFrom(range.from);
    setTo(range.to);
    fetchReport(range.from, range.to);
  };

  const applyCustom = () => {
    setActivePreset('Custom');
    fetchReport(from, to);
  };

  const generateSummary = async () => {
    if (!report) return;
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/financials/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: report.from, to: report.to, reportData: report }),
      });
      const data = await res.json();
      setAiSummary(data.summary ?? 'Unable to generate summary.');
    } catch {
      setAiSummary('Failed to generate AI summary.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const exportPDF = () => {
    if (!report) return;
    const html = buildPrintHTML(report, gstRate, currency);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.print(); };
  };

  return (
    <div className="space-y-6">
      {/* Date picker card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.label, p.fn)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activePreset === p.label
                  ? 'bg-amber-700 border-amber-600 text-white'
                  : 'border-stone-200 text-stone-600 hover:border-amber-600 hover:text-amber-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setActivePreset('Custom')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activePreset === 'Custom'
                ? 'bg-amber-700 border-amber-600 text-white'
                : 'border-stone-200 text-stone-600 hover:border-amber-600 hover:text-amber-700'
            }`}
          >
            Custom
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-500 font-medium">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset('Custom'); }}
              className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-500 font-medium">To</label>
            <input
              type="date"
              value={to}
              min={from}
              max={todayStr()}
              onChange={(e) => { setTo(e.target.value); setActivePreset('Custom'); }}
              className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-amber-600"
            />
          </div>
          <button
            onClick={applyCustom}
            className="text-xs px-4 py-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors"
          >
            Apply
          </button>
          {report && (
            <>
              <button
                onClick={generateSummary}
                disabled={loadingSummary}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-amber-600 text-amber-700 rounded-lg hover:bg-amber-700/5 transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} />
                {loadingSummary ? 'Summarising…' : 'Summarise this period'}
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors ml-auto"
              >
                <Printer size={12} />
                Export as PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-gradient-to-r from-[amber-700]/5 to-amber-50 rounded-xl border border-amber-600/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-amber-700" />
            <span className="text-sm font-semibold text-stone-900">AI Period Summary</span>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Loading */}
      {loadingReport && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              <Skeleton h="h-4" w="w-24" />
              <Skeleton h="h-8" />
            </div>
          ))}
        </div>
      )}

      {reportError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{reportError}</div>
      )}

      {report && !loadingReport && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={fmt(report.totalRevenue, currency)} icon={<DollarSign size={16} />} />
            <StatCard label="Net Revenue" value={fmt(report.netRevenue, currency)} sub={`After ${fmt(report.totalRefunds, currency)} refunds`} icon={<TrendingUp size={16} />} />
            <StatCard label="GST Collected" value={fmt(report.gstCollected, currency)} sub="Estimate" icon={<ReceiptText size={16} />} />
            <StatCard label="Transactions" value={String(report.totalTransactions)} sub={`Avg ${fmt(report.avgSaleValue, currency)}`} icon={<CreditCard size={16} />} />
          </div>

          {/* Revenue chart */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <h2 className="font-semibold text-stone-900 mb-4">
              Revenue {report.useWeekly ? '(weekly)' : '(daily)'} — {new Date(report.from + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} to {new Date(report.to + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </h2>
            <RevenueChart data={report.chartData} />
          </div>

          {/* Revenue by category */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <h2 className="font-semibold text-stone-900 mb-4">Revenue by Category</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'POS Sales', value: report.revenueByCategory.posSales },
                { label: 'Invoices', value: report.revenueByCategory.invoices },
                { label: 'Repairs', value: report.revenueByCategory.repairs },
                { label: 'Bespoke Jobs', value: report.revenueByCategory.bespoke },
              ].map((cat) => (
                <div key={cat.label} className="bg-stone-50 rounded-lg p-4">
                  <p className="text-xs text-stone-500 mb-1">{cat.label}</p>
                  <p className="text-lg font-semibold text-stone-900">{fmt(cat.value, currency)}</p>
                  {report.totalRevenue > 0 && (
                    <div className="mt-2 h-1 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-1 bg-amber-700 rounded-full"
                        style={{ width: `${Math.min((cat.value / report.totalRevenue) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment methods + Top customers + Top products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment methods */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200">
                <h2 className="font-semibold text-stone-900 text-sm">Payment Methods</h2>
              </div>
              {Object.keys(report.paymentBreakdown).length === 0 ? (
                <p className="px-5 py-8 text-sm text-stone-400 text-center">No data</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {Object.entries(report.paymentBreakdown).sort((a, b) => b[1] - a[1]).map(([method, total]) => (
                    <div key={method} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm capitalize text-stone-700">{method.replace('_', ' ')}</span>
                      <span className="text-sm font-semibold text-stone-900">{fmt(total, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top customers */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200">
                <h2 className="font-semibold text-stone-900 text-sm">Top 5 Customers</h2>
              </div>
              {report.topCustomers.length === 0 ? (
                <p className="px-5 py-8 text-sm text-stone-400 text-center">No data</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {report.topCustomers.map((c, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 w-4">{i + 1}</span>
                        <span className="text-sm text-stone-700">{c.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-stone-900">{fmt(c.total, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top products */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200">
                <h2 className="font-semibold text-stone-900 text-sm">Top 5 Products</h2>
              </div>
              {report.topProducts.length === 0 ? (
                <p className="px-5 py-8 text-sm text-stone-400 text-center">No sale item data</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {report.topProducts.map((p, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 w-4">{i + 1}</span>
                        <div>
                          <p className="text-sm text-stone-700">{p.name}</p>
                          <p className="text-xs text-stone-400">{p.qty} units</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-stone-900">{fmt(p.revenue, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildPrintHTML(r: ReportData, gst: number, currency: string) {
  const dateRange = `${new Date(r.from + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} → ${new Date(r.to + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const row = (label: string, val: string, bold = false) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right${bold ? ';font-weight:700;color:#111' : ''}">${val}</td></tr>`;
  return `<!DOCTYPE html><html><head><title>Financial Report</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;padding:40px;max-width:700px;margin:0 auto}
    h1{font-size:22px;font-weight:700;margin-bottom:4px}
    h2{font-size:15px;font-weight:600;margin:24px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#f5f0eb;color:amber-700;font-size:12px;font-weight:600}
    @media print{body{padding:20px}}
  </style></head><body>
    <h1>Financial Report</h1>
    <p class="badge">${dateRange}</p>
    <h2>Revenue Summary</h2>
    <table>
      ${row('Total Revenue', fmtFull(r.totalRevenue, currency), true)}
      ${row('Total Refunds', '−' + fmtFull(r.totalRefunds, currency))}
      ${row('Net Revenue', fmtFull(r.netRevenue, currency), true)}
      ${row('GST Collected (est.)', fmtFull(r.gstCollected, currency))}
      ${row('Total Transactions', String(r.totalTransactions))}
      ${row('Average Sale Value', fmtFull(r.avgSaleValue, currency))}
    </table>
    <h2>Revenue by Category</h2>
    <table>
      ${row('POS Sales', fmtFull(r.revenueByCategory.posSales, currency))}
      ${row('Invoices', fmtFull(r.revenueByCategory.invoices, currency))}
      ${row('Repairs', fmtFull(r.revenueByCategory.repairs, currency))}
      ${row('Bespoke Jobs', fmtFull(r.revenueByCategory.bespoke, currency))}
    </table>
    <h2>Payment Methods</h2>
    <table>${Object.entries(r.paymentBreakdown).map(([m, v]) => row(m.charAt(0).toUpperCase() + m.slice(1), fmtFull(v as number, currency))).join('') || '<tr><td colspan="2" style="padding:8px 12px;color:#9ca3af">No data</td></tr>'}</table>
    <h2>Top 5 Customers</h2>
    <table>${r.topCustomers.map((c, i) => row(`${i + 1}. ${c.name}`, fmtFull(c.total, currency))).join('') || '<tr><td colspan="2" style="padding:8px 12px;color:#9ca3af">No data</td></tr>'}</table>
    <h2>Top 5 Products</h2>
    <table>${r.topProducts.map((p, i) => row(`${i + 1}. ${p.name} (${p.qty} units)`, fmtFull(p.revenue, currency))).join('') || '<tr><td colspan="2" style="padding:8px 12px;color:#9ca3af">No data</td></tr>'}</table>
    <p style="margin-top:32px;font-size:11px;color:#9ca3af">Generated by Nexpura · GST rate used: ${(gst * 100).toFixed(0)}% · This is an estimate. Consult your accountant for official BAS lodgement.</p>
  </body></html>`;
}
