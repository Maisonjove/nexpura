'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { MappingTable } from '../../_components/MappingTable';
import { ArrowRight, FileText } from 'lucide-react';

interface MappingRecord {
  id: string;
  entity_type: string;
  mappings: any[];
  migration_files?: {
    original_name: string;
    detected_entity: string;
    row_count: number;
  } | null;
}

interface Props {
  sessionId: string;
  mappings: MappingRecord[];
  rt?: string;
}

function MappingTableWrapperInner({ sessionId, mappings, rt }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseInt(searchParams.get('tab') || '0', 10);
  const [saving, setSaving] = useState(false);

  if (mappings.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
        <FileText className="w-8 h-8 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-600 text-sm font-medium">No mappings yet</p>
        <p className="text-stone-400 text-xs mt-1">Upload files first so AI can generate mappings</p>
      </div>
    );
  }

  async function handleContinue() {
    setSaving(true);
    await fetch('/api/migration/update-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, status: 'preview' }),
    });
    const rtSuffix = rt ? `?rt=${rt}` : '';
    router.push(`/migration/${sessionId}/preview${rtSuffix}`);
  }

  const current = mappings[activeTab];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {mappings.length > 1 && (
        <div className="flex gap-2 border-b border-stone-200 pb-0">
          {mappings.map((m, i) => (
            <button
              key={m.id}
              onClick={() => router.replace(pathname + (i !== 0 ? '?tab=' + i : ''))}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                i === activeTab
                  ? 'border-[amber-700] text-amber-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {m.migration_files?.original_name || m.entity_type}
              {m.migration_files?.row_count && (
                <span className="ml-1.5 text-xs text-stone-400">({m.migration_files.row_count.toLocaleString()} rows)</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-stone-900 capitalize">{current.entity_type} Fields</h3>
            {current.migration_files && (
              <p className="text-xs text-stone-500 mt-0.5">{current.migration_files.original_name}</p>
            )}
          </div>
        </div>
        <MappingTable
          mappings={current.mappings || []}
          entityType={current.entity_type}
        />
      </div>

      <button
        onClick={handleContinue}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-amber-700 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : <><span>Continue to Preview</span> <ArrowRight className="w-4 h-4" /></>}
      </button>
    </div>
  );
}

 Claude is active in this tab group  
Open chat
 
Dismiss

export function MappingTableWrapper(props: Parameters<typeof MappingTableWrapperInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <MappingTableWrapperInner {...props} />
    </Suspense>
  );
}
