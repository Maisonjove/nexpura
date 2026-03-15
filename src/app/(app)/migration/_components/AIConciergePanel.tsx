'use client';

import { Bot, Sparkles, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

interface AISummary {
  understanding?: string;
  risks?: string[];
  suggestions?: string[];
  confidence?: number;
  overall?: string;
}

interface AIConciergePanelProps {
  summary: AISummary | null;
  loading?: boolean;
  sessionId?: string;
}

export function AIConciergePanel({ summary, loading, sessionId }: AIConciergePanelProps) {
  if (loading) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-semibold text-amber-900">AI Migration Concierge</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-amber-200 rounded animate-pulse w-full" />
          <div className="h-3 bg-amber-200 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-amber-200 rounded animate-pulse w-3/5" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-semibold text-amber-900">AI Migration Concierge</span>
        </div>
        <p className="text-xs text-amber-700">
          Upload your files to get AI-powered insights about your migration. I&apos;ll analyze your data, identify any risks, and guide you through each step.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-semibold text-amber-900">AI Migration Concierge</span>
        </div>
        {summary.confidence !== undefined && (
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">{Math.round(summary.confidence * 100)}% confident</span>
          </div>
        )}
      </div>

      {summary.understanding && (
        <p className="text-xs text-amber-800 leading-relaxed">{summary.understanding}</p>
      )}

      {summary.overall && (
        <p className="text-xs text-amber-800 leading-relaxed">{summary.overall}</p>
      )}

      {summary.risks && summary.risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-900 flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Risks Identified
          </p>
          <ul className="space-y-1">
            {summary.risks.map((risk, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-600 mt-0.5">•</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.suggestions && summary.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-900 flex items-center gap-1 mb-1">
            <CheckCircle className="w-3.5 h-3.5" /> Recommended Next Steps
          </p>
          <ul className="space-y-1">
            {summary.suggestions.map((suggestion, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
