'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Sparkles, Send, Printer, Calendar, DollarSign, ReceiptText, AlertCircle, CreditCard, BarChart3 } from 'lucide-react';
import RevenueChart from './RevenueChart';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricsData {
  revenueThisMonth: number;
  revenueLastMonth: number;
  refundsThisMonth: number;
  refundCount: number;
  outstanding: number;
  outstandingCount: number;
  gstCollected: number;
  avgSaleValue: number;
  salesCount: number;
  paymentBreakdown: Record<string, number>;
  chartData: { date: string; label: string; revenue: number; refunds: number }[];
  quarterlyGST: { label: string; revenue: number; gst: number }[];
  gstRate: number;
}

interface ReportData {
  from: string;
  to: string;
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  gstCollected: number;
  totalTransactions: number;
  avgSaleValue: number;
  revenueByCategory: { posSales: number; invoices: number; repairs: number; bespoke: number };
  topCustomers: { name: string; total: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  paymentBreakdown: Record<string, number>;
  chartData: { label: string; revenue: number; refunds: number }[];
  useWeekly: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtFull(n: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(n);
}

function pctChange(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev * 100).toFixed(1);
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthStartStr() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]; }
function lastMonthRange() {
  const n = new Date();
  const s = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  const e = new Date(n.getFullYear(), n.getMonth(), 0);
  return { from: s.toISOString().split('T')[0], to: e.toISOString().split('T')[0] };
}
function thisWeekRange() {
  const n = new Date(); const day = n.getDay();
  const mon = new Date(n); mon.setDate(n.getDate() - (day === 0 ? 6 : day - 1));
  return { from: mon.toISOString().split('T')[0], to: todayStr() };
}
function thisQuarterRange() {
  const n = new Date(); const q = Math.floor(n.getMonth() / 3);
  return { from: new Date(n.getFullYear(), q * 3, 1).toISOString().split('T')[0], to: todayStr() };
}
function lastQuarterRange() {
  const n = new Date(); const q = Math.floor(n.getMonth() / 3);
  const lqs = q === 0 ? new Date(n.getFullYear() - 1, 9, 1) : new Date(n.getFullYear(), (q - 1) * 3, 1);
  const lqe = q === 0 ? new Date(n.getFullYear() - 1, 12, 0) : new Date(n.getFullYear(), q * 3, 0);
  return { from: lqs.toISOString().split('T')[0], to: lqe.toISOString().split('T')[0] };
}
function thisYearRange() {
  const n = new Date();
  return { from: new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0], to: todayStr() };
}

const PRESETS = [
  { label: 'Today', fn: () => ({ from: todayStr(), to: todayStr() }) },
  { label: 'This Week', fn: thisWeekRange },
  { label: 'This Month', fn: () => ({ from: monthStartStr(), to: todayStr() }) },
  { label: 'Last Month', fn: lastMonthRange },
  { label: 'This Quarter', fn: thisQuarterRange },
  { label: 'Last Quarter', fn: lastQuarterRange },
  { label: 'This Year', fn: thisYearRange },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, icon, urgent }: {
  label: string; value: string; sub?: string; trend?: string | null; icon: React.ReactNode; urgent?: boolean;
}) {
  const up = trend && parseFloat(trend) >= 0;
  return (
    <div className={`bg-white rounded-xl border ${urgent ? 'border-red-200' : 'border-stone-200'} p-5 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${urgent ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-[#8B7355]'}`}>
          {icon}
        </div>
      </div>
      <p className={`font-semibold text-2xl ${urgent ? 'text-red-500' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {up ? '+' : ''}{trend}% vs last month
        </div>
      )}
    </div>
  );
}

function Skeleton({ h = 'h-8', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-stone-100 rounded-lg animate-pulse`} />;
}

// ─── AI Insights Panel ────────────────────────────────────────────────────────

function AIInsightsPanel() {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/financial-insights');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsights(data.insights ?? []);
      setGeneratedAt(data.generatedAt);
    } catch {
      setError('AI insights unavailable — check your OpenAI API key or try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const iconFor = (text: string) => {
    if (text.startsWith('✅')) return null;
    if (text.startsWith('⚠️')) return null;
    if (text.startsWith('💡')) return null;
    return '💡';
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#8B7355]" />
          <h2 className="font-semibold text-stone-900">AI Financial Insights</h2>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analysing…' : 'Refresh'}
        </button>
      </div>
      <div className="p-6">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton h="h-10" w="w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton h="h-4" />
                  <Skeleton h="h-4" w="w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {!loading && !error && insights.length > 0 && (
          <div className="space-y-3">
            {insights.map((insight, i) => {
              const isWarning = insight.startsWith('⚠️');
              const isPositive = insight.startsWith('✅');
              const extra = iconFor(insight);
              const displayText = (insight.startsWith('✅') || insight.startsWith('⚠️') || insight.startsWith('💡'))
                ? insight.slice(insight.indexOf(' ') + 1)
                : insight;
              return (
                <div
                  key={i}
                  className={`flex gap-3 p-4 rounded-lg border ${
                    isWarning ? 'bg-amber-50 border-amber-200' :
                    isPositive ? 'bg-emerald-50 border-emerald-200' :
                    'bg-stone-50 border-stone-200'
                  }`}
                >
                  <span className="text-lg flex-shrink-0 leading-none mt-0.5">
                    {isWarning ? '⚠️' : isPositive ? '✅' : extra ?? '💡'}
                  </span>
                  <p className="text-sm text-stone-700 leading-relaxed">{displayText}</p>
                </div>
              );
            })}
          </div>
        )}
        {generatedAt && !loading && (
          <p className="text-xs text-stone-400 mt-4">
            Generated {new Date(generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Financial Chat ───────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "What's my best selling category?",
  "How much GST do I owe?",
  "Which customers spend the most?",
  "What are my slowest moving items?",
];

function FinancialChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg].slice(-10); // keep last 5 pairs
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/ai/financial-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok || !res.body) throw new Error('Failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: current };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-200">
        <h2 className="font-semibold text-stone-900">Ask Your Finances</h2>
        <p className="text-xs text-stone-400 mt-0.5">Ask anything about your financial data</p>
      </div>
      {/* Example prompts */}
      {messages.length === 0 && (
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs px-3 py-1.5 rounded-full border border-stone-200 text-stone-600 hover:border-[#8B7355] hover:text-[#8B7355] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {/* Messages */}
      {messages.length > 0 && (
        <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#8B7355] text-white rounded-br-sm'
                  : 'bg-stone-100 text-stone-800 rounded-bl-sm'
              }`}>
                {m.content || (streaming && i === messages.length - 1 ? <span className="animate-pulse">…</span> : '')}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      {/* Input */}
      <div className="px-6 py-4 border-t border-stone-100">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your finances…"
            disabled={streaming}
            className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]/20 disabled:opacity-50 placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-3 py-2 bg-[#8B7355] text-white rounded-lg hover:bg-[#7a6447] transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Financial Report Tab ─────────────────────────────────────────────────────

function FinancialReportTab({ gstRate, currency = 'AUD' }: { gstRate: number; currency?: string }) {
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
    const html = buildPrintHTML(report, gstRate);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.print(); };
  };

  const buildPrintHTML = (r: ReportData, gst: number) => {
    const dateRange = `${new Date(r.from + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} → ${new Date(r.to + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const row = (label: string, val: string, bold = false) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right${bold ? ';font-weight:700;color:#111' : ''}">${val}</td></tr>`;
    return `<!DOCTYPE html><html><head><title>Financial Report</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;padding:40px;max-width:700px;margin:0 auto}
      h1{font-size:22px;font-weight:700;margin-bottom:4px}
      h2{font-size:15px;font-weight:600;margin:24px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      .badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#f5f0eb;color:#8B7355;font-size:12px;font-weight:600}
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
                  ? 'bg-[#8B7355] border-[#8B7355] text-white'
                  : 'border-stone-200 text-stone-600 hover:border-[#8B7355] hover:text-[#8B7355]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setActivePreset('Custom')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activePreset === 'Custom'
                ? 'bg-[#8B7355] border-[#8B7355] text-white'
                : 'border-stone-200 text-stone-600 hover:border-[#8B7355] hover:text-[#8B7355]'
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
              className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#8B7355]"
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
              className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#8B7355]"
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
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#8B7355] text-[#8B7355] rounded-lg hover:bg-[#8B7355]/5 transition-colors disabled:opacity-50"
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
        <div className="bg-gradient-to-r from-[#8B7355]/5 to-amber-50 rounded-xl border border-[#8B7355]/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-[#8B7355]" />
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
                        className="h-1 bg-[#8B7355] rounded-full"
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinancialsClient({
  tenantId: _tenantId,
  businessName,
  gstRate,
  currency = 'AUD',
}: {
  tenantId: string;
  businessName: string;
  gstRate: number;
  currency?: string;
}) {
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
                ? 'border-[#8B7355] text-[#8B7355]'
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
                                <div className="h-1.5 bg-[#8B7355] rounded-full" style={{ width: `${pct}%` }} />
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
