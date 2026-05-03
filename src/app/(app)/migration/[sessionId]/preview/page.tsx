import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MigrationStepper } from '../../_components/MigrationStepper';
import { PreviewClient } from './PreviewClient';

export const metadata = { title: "Migration · Preview — Nexpura" };

interface Props {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ rt?: string }>;
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const { rt } = await searchParams;
  const { tenantId, admin } = await getAuthOrReviewContext(rt);

  if (!tenantId) redirect('/login');

  const { data: session } = await admin
    .from('migration_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!session) redirect('/migration');

  const { data: files } = await admin
    .from('migration_files')
    .select('*')
    .eq('session_id', sessionId);

  const { data: mappings } = await admin
    .from('migration_mappings')
    .select('file_id, mappings')
    .eq('session_id', sessionId);

  // Build preview summary from files
  const summary: Array<{ entity: string; create: number; update: number; skip: number; errors: number; warnings: number }> = [];

  if (files) {
    const entityMap: Record<string, typeof summary[0]> = {};
    for (const f of files) {
      const entity = f.detected_entity || 'unknown';
      if (!entityMap[entity]) {
        entityMap[entity] = { entity, create: 0, update: 0, skip: 0, errors: 0, warnings: 0 };
      }
      entityMap[entity].create += f.row_count || 0;
    }
    summary.push(...Object.values(entityMap));
  }

  // W14-DATA-INT (Group 13 audit): compute unmapped CSV columns per file.
  // Pre-fix: any source column not auto-mapped was silently dropped at
  // execute time — a CSV `notes` column went into the void with no
  // warning to the user. Now we surface the diff (source headers minus
  // mapping sources) on the preview page so the user can see what data
  // they're about to discard and either accept it or jump back to /mapping.
  type Unmapped = { fileId: string; fileName: string; entity: string; unmappedColumns: string[] };
  const unmappedPerFile: Unmapped[] = [];
  if (files) {
    const mappingByFile = new Map<string, { mappings: unknown }>();
    for (const m of mappings ?? []) {
      mappingByFile.set(m.file_id as string, m as { mappings: unknown });
    }
    for (const f of files) {
      const headers = ((f.column_headers as string[] | null) ?? []).filter((h) => typeof h === "string" && h.trim().length > 0);
      if (headers.length === 0) continue;

      const fileMapping = mappingByFile.get(f.id);
      // mappings shape varies — could be { source: dest } object, an array
      // of { source, destination } pairs, or null. Normalize to a Set of
      // mapped source column names.
      const mappedSources = new Set<string>();
      const mObj = fileMapping?.mappings as unknown;
      if (mObj && typeof mObj === "object") {
        if (Array.isArray(mObj)) {
          for (const item of mObj as Array<{ source?: string; sourceColumn?: string; from?: string }>) {
            const k = item.source || item.sourceColumn || item.from;
            if (k) mappedSources.add(k);
          }
        } else {
          for (const [k, v] of Object.entries(mObj as Record<string, unknown>)) {
            // Skip nulls / "(skip)" / blank — those are explicitly NOT mapped.
            if (v && v !== "(skip)" && v !== "skip" && String(v).trim().length > 0) {
              mappedSources.add(k);
            }
          }
        }
      }

      const unmapped = headers.filter((h) => !mappedSources.has(h));
      if (unmapped.length > 0) {
        unmappedPerFile.push({
          fileId: f.id,
          fileName: (f.original_name as string) ?? "(unnamed)",
          entity: (f.detected_entity as string) ?? "unknown",
          unmappedColumns: unmapped,
        });
      }
    }
  }

  const totalErrors = 0;
  const totalWarnings = summary.reduce((sum, s) => sum + s.warnings, 0)
    + unmappedPerFile.reduce((sum, u) => sum + u.unmappedColumns.length, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/migration/${sessionId}/mapping`} className="text-stone-400 hover:text-stone-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Import Preview</h1>
            <p className="text-stone-500 text-sm">Review what will be imported before starting</p>
          </div>
        </div>
        <MigrationStepper sessionId={sessionId} currentStep={3} />
      </div>

      <PreviewClient
        sessionId={sessionId}
        summary={summary}
        totalErrors={totalErrors}
        totalWarnings={totalWarnings}
        aiSummary={session.ai_summary}
        dataScope={session.data_scope}
        rt={rt}
        unmappedColumns={unmappedPerFile}
      />
    </div>
  );
}
