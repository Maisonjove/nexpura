'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, Calendar, DollarSign, ReceiptText, AlertCircle, TrendingDown, BarChart3 } from 'lucide-react';
// Lazy-load heavy chart library (recharts ~400KB) — only loaded when financials page is visited
const RevenueChart = dynamic(() => import('./RevenueChart'), { ssr: false });
import {
  StatCard,
  Skeleton,
  AIInsightsPanel,
  FinancialChat,
  FinancialReportTab,
  fmt,
  pctChange,
} from './components';
import type { MetricsData } from './components/types';

interface FinancialsClientProps {
  tenantId: string;
  businessName: string;
  gstRate: number;
  currency?: string;
}

export default function FinancialsClient({
  tenantId: _tenantId,
  businessName,
  gstRate,
  currency = 'AUD',
}: FinancialsClientProps) {
  const [tab, setTab] = useState<'dashboard' | 'reports'>('dashboard');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    fetch('/api/financials/metrics')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMetrics(d); })
      .finally(() => setLoadingMetrics(false));
  }, []);

  const now = new Date();
  const monthLabel = now.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl text-stone-900">Financials</h1>
          <p className="text-stone-500 mt-1 text-sm">{businessName} · {monthLabel}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {[
          { key: 'dashboard', label: 'AI Dashboard', icon: <Sparkles size={13} /> },
          { key: 'reports', label: 'Financial Reports', icon: <Calendar size={13} /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="space-y-8">
          {/* Section 1 — Key Metrics */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Key Metrics — {monthLabel}</h2>
            {loadingMetrics ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
                    <Skeleton h="h-3" w="w-24" />
                    <Skeleton h="h-8" />
                  </div>
                ))}
              </div>
            ) : metrics ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Revenue This Month"
                  value={fmt(metrics.revenueThisMonth, currency)}
                  trend={pctChange(metrics.revenueThisMonth, metrics.revenueLastMonth)}
                  icon={<DollarSign size={16} />}
                />
                <StatCard
                  label="GST Collected"
                  value={fmt(metrics.gstCollected, currency)}
                  sub={`${(metrics.gstRate * 100).toFixed(0)}% rate (estimate)`}
                  icon={<ReceiptText size={16} />}
                />
                <StatCard
                  label="Outstanding Invoices"
                  value={fmt(metrics.outstanding, currency)}
                  sub={`${metrics.outstandingCount} invoice${metrics.outstandingCount !== 1 ? 's' : ''}`}
                  icon={<AlertCircle size={16} />}
                  urgent={metrics.outstandingCount > 0}
                />
                <StatCard
                  label="Refunds This Month"
                  value={fmt(metrics.refundsThisMonth, currency)}
                  sub={`${metrics.refundCount} refund${metrics.refundCount !== 1 ? 's' : ''}`}
                  icon={<TrendingDown size={16} />}
                />
                <StatCard
                  label="Avg Sale Value"
                  value={fmt(metrics.avgSaleValue, currency)}
                  sub={`${metrics.salesCount} sales this month`}
                  icon={<BarChart3 size={16} />}
                />
                <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Payment Mix</p>
                  {Object.keys(metrics.paymentBreakdown).length === 0 ? (
                    <p className="text-sm text-stone-400">No data</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(metrics.paymentBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 4)
                        .map(([method, total]) => {
                          const pct = metrics.revenueThisMonth > 0 ? (total / metrics.revenueThisMonth) * 100 : 0;
                          return (
                            <div key={method}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="capitalize text-stone-600">{method.replace('_', ' ')}</span>
                                <span className="text-stone-500">{pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div className="h-1.5 bg-amber-700 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">Failed to load metrics.</div>
            )}
          </section>

          {/* Section 2 — AI Insights */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">AI Insights</h2>
            <AIInsightsPanel />
          </section>

          {/* Section 4 — Revenue Chart */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Revenue — Last 30 Days</h2>
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
              {loadingMetrics ? (
                <Skeleton h="h-48" />
              ) : metrics?.chartData ? (
                <RevenueChart data={metrics.chartData} />
              ) : null}
            </div>
          </section>

          {/* Section 5 — GST Summary */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">GST Summary</h2>
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
              {loadingMetrics ? (
                <div className="space-y-3"><Skeleton /><Skeleton h="h-32" /></div>
              ) : metrics ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-stone-50 rounded-lg">
                      <p className="text-xs text-stone-500 mb-1">GST Collected</p>
                      <p className="text-xl font-semibold text-stone-900">{fmt(metrics.gstCollected, currency)}</p>
                      <p className="text-xs text-stone-400 mt-0.5">this month</p>
                    </div>
                    <div className="text-center p-4 bg-stone-50 rounded-lg">
                      <p className="text-xs text-stone-500 mb-1">GST on Purchases</p>
                      <p className="text-xl font-semibold text-stone-400">—</p>
                      <p className="text-xs text-stone-400 mt-0.5">not tracked</p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600 mb-1">Net GST Position</p>
                      <p className="text-xl font-semibold text-emerald-700">{fmt(metrics.gstCollected, currency)}</p>
                      <p className="text-xs text-emerald-500 mt-0.5">payable</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 mb-4 italic">
                    ⚠️ This is an estimate based on tax-inclusive revenue at {(metrics.gstRate * 100).toFixed(0)}%. Consult your accountant for official BAS lodgement.
                  </p>
                  {/* Quarterly breakdown */}
                  {metrics.quarterlyGST && metrics.quarterlyGST.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-stone-700 mb-3">Quarterly GST (Last 4 Quarters)</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {metrics.quarterlyGST.map((q) => (
                          <div key={q.label} className="bg-stone-50 rounded-lg p-3">
                            <p className="text-xs text-stone-500 mb-1">{q.label}</p>
                            <p className="text-base font-semibold text-stone-900">{fmt(q.gst, currency)}</p>
                            <p className="text-xs text-stone-400">of {fmt(q.revenue, currency)} rev.</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : null}
            </div>
          </section>

          {/* Section 3 — AI Chat */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Ask Your Finances</h2>
            <FinancialChat />
          </section>
        </div>
      )}

      {/* Reports Tab */}
      {tab === 'reports' && <FinancialReportTab gstRate={gstRate} currency={currency} />}
    </div>
  );
}
