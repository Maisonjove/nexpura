import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MigrationStepper } from '../../_components/MigrationStepper';
import { PreviewClient } from './PreviewClient';


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

  const totalErrors = 0;
  const totalWarnings = summary.reduce((sum, s) => sum + s.warnings, 0);

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
      />
    </div>
  );
}
