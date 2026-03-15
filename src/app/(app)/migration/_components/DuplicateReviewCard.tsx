'use client';

import { useState } from 'react';
import { Users, Merge, X, Minus } from 'lucide-react';

interface DuplicatePair {
  id: string;
  entityType: string;
  existing: Record<string, string>;
  incoming: Record<string, string>;
  matchReason: string;
  confidence: number;
  action?: 'separate' | 'merge' | 'skip';
}

interface DuplicateReviewCardProps {
  pair: DuplicatePair;
  onAction: (id: string, action: 'separate' | 'merge' | 'skip') => void;
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.9 ? 'text-red-700 bg-red-50 border-red-200' : score >= 0.7 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>{pct}% match</span>
  );
}

export function DuplicateReviewCard({ pair, onAction }: DuplicateReviewCardProps) {
  const [selected, setSelected] = useState<string | null>(pair.action || null);

  function handleAction(action: 'separate' | 'merge' | 'skip') {
    setSelected(action);
    onAction(pair.id, action);
  }

  const displayFields = ['name', 'full_name', 'email', 'phone', 'address', 'sku'].filter(
    f => pair.existing[f] || pair.incoming[f]
  );

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${selected ? 'border-stone-300' : 'border-amber-200'}`}>
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-semibold text-amber-900 capitalize">{pair.entityType} duplicate</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-700">{pair.matchReason}</span>
          <ConfidenceBadge score={pair.confidence} />
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Existing in Nexpura</p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-1">
              {displayFields.length > 0 ? displayFields.map(f => (
                pair.existing[f] && (
                  <div key={f} className="flex gap-2">
                    <span className="text-xs text-stone-500 w-16 flex-shrink-0 capitalize">{f}:</span>
                    <span className="text-xs text-stone-900 font-medium">{pair.existing[f]}</span>
                  </div>
                )
              )) : <p className="text-xs text-stone-500">No data</p>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Incoming from file</p>
            <div className="bg-stone-50 rounded-lg p-3 space-y-1">
              {displayFields.length > 0 ? displayFields.map(f => (
                pair.incoming[f] && (
                  <div key={f} className="flex gap-2">
                    <span className="text-xs text-stone-500 w-16 flex-shrink-0 capitalize">{f}:</span>
                    <span className="text-xs text-stone-900 font-medium">{pair.incoming[f]}</span>
                  </div>
                )
              )) : <p className="text-xs text-stone-500">No data</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleAction('merge')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              selected === 'merge'
                ? 'bg-[#B45309] text-white border-[#B45309]'
                : 'border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <Merge className="w-3.5 h-3.5" /> Merge
          </button>
          <button
            onClick={() => handleAction('separate')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              selected === 'separate'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <X className="w-3.5 h-3.5" /> Keep Separate
          </button>
          <button
            onClick={() => handleAction('skip')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              selected === 'skip'
                ? 'bg-stone-200 text-stone-700 border-stone-300'
                : 'border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <Minus className="w-3.5 h-3.5" /> Skip Incoming
          </button>
        </div>
      </div>
    </div>
  );
}
