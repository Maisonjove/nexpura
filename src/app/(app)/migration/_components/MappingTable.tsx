'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, ChevronDown } from 'lucide-react';
import { NEXPURA_FIELDS } from '@/lib/migration/adapters';

interface MappingRow {
  source_col: string;
  destination_field: string | null;
  confidence: number;
  transformation: string | null;
  warning: string | null;
  status: 'auto' | 'review' | 'ignored' | 'manual';
}

interface MappingTableProps {
  mappings: MappingRow[];
  entityType: string;
  onUpdate?: (updatedMappings: MappingRow[]) => void;
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.9 ? 'text-green-700 bg-green-50' : score >= 0.6 ? 'text-amber-700 bg-amber-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{pct}%</span>
  );
}

export function MappingTable({ mappings: initialMappings, entityType, onUpdate }: MappingTableProps) {
  const [mappings, setMappings] = useState<MappingRow[]>(initialMappings);
  const [editingRow, setEditingRow] = useState<number | null>(null);

  const fields = NEXPURA_FIELDS[entityType] || [];
  const autoCount = mappings.filter(m => m.status === 'auto').length;
  const reviewCount = mappings.filter(m => m.status === 'review' || (m.confidence < 0.6 && m.status !== 'ignored')).length;
  const ignoredCount = mappings.filter(m => m.status === 'ignored').length;

  function updateMapping(idx: number, field: string | null) {
    const updated = mappings.map((m, i) => {
      if (i !== idx) return m;
      return { ...m, destination_field: field, status: 'manual' as const };
    });
    setMappings(updated);
    onUpdate?.(updated);
    setEditingRow(null);
  }

  function toggleIgnore(idx: number) {
    const updated = mappings.map((m, i) => {
      if (i !== idx) return m;
      return { ...m, status: m.status === 'ignored' ? 'review' as const : 'ignored' as const };
    });
    setMappings(updated);
    onUpdate?.(updated);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="flex items-center gap-1.5 text-green-700">
          <CheckCircle className="w-4 h-4" />
          {autoCount} auto-mapped
        </span>
        {reviewCount > 0 && (
          <span className="flex items-center gap-1.5 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            {reviewCount} need review
          </span>
        )}
        {ignoredCount > 0 && (
          <span className="flex items-center gap-1.5 text-stone-500">
            <XCircle className="w-4 h-4" />
            {ignoredCount} ignored
          </span>
        )}
      </div>

      <div className="overflow-x-auto border border-stone-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Source Column</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Nexpura Field</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Confidence</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Notes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {mappings.map((row, idx) => (
              <tr key={idx} className={`${row.status === 'ignored' ? 'opacity-50' : ''} hover:bg-stone-50 transition-colors`}>
                <td className="px-4 py-3 font-mono text-xs text-stone-700 font-medium">{row.source_col}</td>
                <td className="px-4 py-3">
                  {editingRow === idx ? (
                    <div className="relative">
                      <select
                        autoFocus
                        defaultValue={row.destination_field || ''}
                        onChange={(e) => updateMapping(idx, e.target.value || null)}
                        onBlur={() => setEditingRow(null)}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="">— Ignore —</option>
                        {fields.map((f) => (
                          <option key={f.field} value={f.field}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingRow(idx)}
                      className="flex items-center gap-1 text-stone-700 hover:text-stone-900 group"
                    >
                      <span className={row.destination_field ? 'font-medium' : 'text-stone-400 italic'}>
                        {row.destination_field
                          ? fields.find(f => f.field === row.destination_field)?.label || row.destination_field
                          : '— not mapped —'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.destination_field && <ConfidenceBadge score={row.confidence} />}
                </td>
                <td className="px-4 py-3 text-xs text-stone-500 max-w-xs">
                  {row.transformation && <span className="text-stone-600">Transform: {row.transformation}</span>}
                  {row.warning && <span className="text-amber-600 block">{row.warning}</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleIgnore(idx)}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    {row.status === 'ignored' ? 'Restore' : 'Ignore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
