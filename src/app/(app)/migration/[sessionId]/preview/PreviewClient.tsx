'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportPreviewPanel } from '../../_components/ImportPreviewPanel';
import { AIConciergePanel } from '../../_components/AIConciergePanel';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface EntitySummary {
  entity: string;
  create: number;
  update: number;
  skip: number;
  errors: number;
  warnings: number;
}

interface Props {
  sessionId: string;
  summary: EntitySummary[];
  totalErrors: number;
  totalWarnings: number;
  aiSummary: any;
  dataScope: string;
  rt?: string;
}

export function PreviewClient({ sessionId, summary, totalErrors, totalWarnings, aiSummary, dataScope, rt }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState(dataScope || 'active');
  const [showConfirm, setShowConfirm] = useState(false);
  const [importing, setImporting] = useState(false);

  const totalCreate = summary.reduce((s, e) => s + e.create, 0);

  async function handleImport() {
    setImporting(true);
    try {
      // Update scope
      await fetch('/api/migration/update-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, status: 'executing', dataScope: scope }),
      });
      // Start execution
      const res = await fetch('/api/migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.jobId) {
        const rtSuffix = rt ? `&rt=${rt}` : '';
        router.push(`/migration/${sessionId}/execute?jobId=${data.jobId}${rtSuffix}`);
      }
    } catch {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Concierge */}
      <AIConciergePanel
        summary={aiSummary || {
          understanding: 'Your migration data has been analysed and mapped to Nexpura fields. Review the summary below and confirm when ready.',
          risks: totalErrors > 0 ? [`${totalErrors} records have blocking errors that must be resolved`] : [],
          suggestions: ['Review the record counts below', 'Choose your data scope', 'Click Start Import when ready'],
        }}
      />

      {/* Data Scope */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h3 className="font-semibold text-stone-900 text-sm mb-3">Data Scope</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'active', label: 'Active Only', desc: 'Current customers & stock only' },
            { value: 'active_and_recent', label: 'Active + Recent', desc: 'Last 12 months of history' },
            { value: 'full_archive', label: 'Full Archive', desc: 'All historical data' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer border rounded-xl p-3 transition-colors ${
                scope === opt.value
                  ? 'border-[amber-700] bg-amber-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
                className="sr-only"
              />
              <p className="text-sm font-semibold text-stone-900">{opt.label}</p>
              <p className="text-xs text-stone-500 mt-0.5">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Summary */}
      <ImportPreviewPanel summary={summary} totalErrors={totalErrors} totalWarnings={totalWarnings} />

      {/* Start Import */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={totalErrors > 0}
          className="w-full flex items-center justify-center gap-2 bg-amber-700 text-white text-sm font-bold px-6 py-4 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Import — {totalCreate.toLocaleString()} records <ArrowRight className="w-5 h-5" />
        </button>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Ready to import?</h3>
              <p className="text-sm text-amber-800 mt-1">
                You are about to import <strong>{totalCreate.toLocaleString()} records</strong> into Nexpura.
                This will create real data in your account. You can roll back at the session level if needed.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 bg-amber-700 text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {importing ? 'Starting...' : 'Yes, Start Import'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 border border-stone-200 text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
