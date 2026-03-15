import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, XCircle, ArrowRight, Download, Users, Package, Wrench, HeartHandshake } from 'lucide-react';
import { MigrationStepper } from '../../_components/MigrationStepper';
import { GoLiveChecklist } from '../../_components/GoLiveChecklist';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: session } = await admin
    .from('migration_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) redirect('/migration');

  const { data: job } = await admin
    .from('migration_jobs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sample per-entity breakdown from job records
  const { data: entityBreakdown } = await admin
    .from('migration_job_records')
    .select('entity_type, status')
    .eq('session_id', sessionId)
    .limit(1000);

  const byEntity: Record<string, { success: number; warning: number; error: number; skip: number }> = {};
  for (const row of (entityBreakdown || [])) {
    if (!byEntity[row.entity_type]) {
      byEntity[row.entity_type] = { success: 0, warning: 0, error: 0, skip: 0 };
    }
    const s = row.status as string;
    if (s === 'success') byEntity[row.entity_type].success++;
    else if (s === 'warning') byEntity[row.entity_type].warning++;
    else if (s === 'error') byEntity[row.entity_type].error++;
    else if (s === 'skipped' || s === 'skip') byEntity[row.entity_type].skip++;
  }

  const successCount = job?.success_count || 0;
  const warningCount = job?.warning_count || 0;
  const errorCount = job?.error_count || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Import Complete</h1>
          <p className="text-stone-500 text-sm">Review results and complete your go-live checklist</p>
        </div>
        <MigrationStepper sessionId={sessionId} currentStep={5} completedSteps={[1, 2, 3, 4]} />
      </div>

      {/* Summary Banner */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-start gap-4">
        <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold text-green-900">
            {successCount.toLocaleString()} records imported successfully
          </h2>
          <p className="text-green-700 text-sm mt-1">
            From {session.source_platform} → Nexpura
            {session.created_at && ` on ${new Date(session.created_at).toLocaleDateString()}`}
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-700">
                <AlertCircle className="w-4 h-4" /> {warningCount} warnings
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="w-4 h-4" /> {errorCount} errors
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Per-entity breakdown */}
          {Object.keys(byEntity).length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <h3 className="font-semibold text-stone-900 mb-4">Breakdown by Type</h3>
              <div className="space-y-3">
                {Object.entries(byEntity).map(([entity, counts]) => (
                  <div key={entity} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                    <span className="text-sm font-medium text-stone-700 capitalize">{entity}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-700 font-semibold">{counts.success} ✓</span>
                      {counts.warning > 0 && <span className="text-amber-600">{counts.warning} ⚠</span>}
                      {counts.error > 0 && <span className="text-red-600">{counts.error} ✗</span>}
                      {counts.skip > 0 && <span className="text-stone-400">{counts.skip} skipped</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <h3 className="font-semibold text-stone-900 mb-4">View Imported Data</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/customers" className="flex items-center gap-3 border border-stone-200 rounded-xl p-3 hover:border-stone-300 transition-colors group">
                <Users className="w-5 h-5 text-stone-500" />
                <div>
                  <p className="text-sm font-semibold text-stone-900">Customers</p>
                  <p className="text-xs text-stone-500">View imported</p>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 ml-auto group-hover:text-stone-600" />
              </Link>
              <Link href="/inventory" className="flex items-center gap-3 border border-stone-200 rounded-xl p-3 hover:border-stone-300 transition-colors group">
                <Package className="w-5 h-5 text-stone-500" />
                <div>
                  <p className="text-sm font-semibold text-stone-900">Inventory</p>
                  <p className="text-xs text-stone-500">View imported</p>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 ml-auto group-hover:text-stone-600" />
              </Link>
              <Link href="/repairs" className="flex items-center gap-3 border border-stone-200 rounded-xl p-3 hover:border-stone-300 transition-colors group">
                <Wrench className="w-5 h-5 text-stone-500" />
                <div>
                  <p className="text-sm font-semibold text-stone-900">Repairs</p>
                  <p className="text-xs text-stone-500">View imported</p>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 ml-auto group-hover:text-stone-600" />
              </Link>
              {errorCount > 0 && (
                <button className="flex items-center gap-3 border border-red-200 rounded-xl p-3 hover:border-red-300 transition-colors group bg-red-50">
                  <Download className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Error Report</p>
                    <p className="text-xs text-red-500">Download CSV</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-red-400 ml-auto group-hover:text-red-600" />
                </button>
              )}
            </div>
          </div>

          {errorCount > 0 && (
            <Link
              href="/migration/assisted"
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:border-amber-300 transition-colors"
            >
              <HeartHandshake className="w-5 h-5 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Need help with errors?</p>
                <p className="text-xs text-amber-700">Request assisted migration from our team</p>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600 ml-auto" />
            </Link>
          )}
        </div>

        <div>
          <GoLiveChecklist />
        </div>
      </div>
    </div>
  );
}
