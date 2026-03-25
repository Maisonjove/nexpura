'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import Skeleton from './Skeleton';

export default function AIInsightsPanel() {
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
          <Sparkles size={16} className="text-amber-700" />
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
