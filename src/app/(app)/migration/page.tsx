import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ArrowRight, Upload, HeartHandshake, CheckCircle, Clock, XCircle, Package } from 'lucide-react';
import { TrustBadges } from './_components/TrustBadges';

export const dynamic = 'force-dynamic';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-stone-100 text-stone-600', icon: <Clock className="w-3 h-3" /> },
  files_uploaded: { label: 'Files Uploaded', color: 'bg-amber-50 text-amber-700', icon: <Clock className="w-3 h-3" /> },
  mapping: { label: 'Mapping', color: 'bg-amber-50 text-amber-700', icon: <Clock className="w-3 h-3" /> },
  preview: { label: 'Preview', color: 'bg-amber-50 text-amber-700', icon: <Clock className="w-3 h-3" /> },
  executing: { label: 'Importing', color: 'bg-stone-900 text-white', icon: <Clock className="w-3 h-3" /> },
  complete: { label: 'Complete', color: 'bg-green-50 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: 'Failed', color: 'bg-red-50 text-red-600', icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-stone-100 text-stone-500', icon: <XCircle className="w-3 h-3" /> },
};

function getSessionStep(status: string): string {
  const map: Record<string, string> = {
    draft: 'files',
    files_uploaded: 'mapping',
    mapping: 'mapping',
    preview: 'preview',
    executing: 'execute',
    complete: 'results',
    failed: 'results',
    cancelled: 'files',
  };
  return map[status] || 'files';
}

export default async function MigrationHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('users')
    .select('tenant_id')
    .eq('id', user!.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Get migration sessions
  const { data: sessions } = await adminClient
    .from('migration_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Stats
  const activeSessions = sessions?.filter(s => !['complete', 'failed', 'cancelled'].includes(s.status)) || [];
  const completedSessions = sessions?.filter(s => s.status === 'complete') || [];

  // Get total record counts from completed jobs
  const { data: jobStats } = await adminClient
    .from('migration_jobs')
    .select('success_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'complete');

  const totalRecords = jobStats?.reduce((sum, j) => sum + (j.success_count || 0), 0) || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 mb-2">Nexpura Migration Hub</h1>
            <p className="text-stone-600 text-sm max-w-lg leading-relaxed">
              AI-powered migration concierge. Switch from any jewellery POS — Swim, Jewel360, WJewel, Shopify, and more — with intelligent field mapping, duplicate detection, and a full preview before anything imports.
            </p>
            <div className="mt-4">
              <TrustBadges />
            </div>
          </div>

          <div className="flex flex-col gap-4 min-w-[180px]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-stone-900">{activeSessions.length}</p>
                <p className="text-xs text-stone-500 mt-0.5">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">{completedSessions.length}</p>
                <p className="text-xs text-stone-500 mt-0.5">Complete</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-900">{totalRecords > 1000 ? `${(totalRecords / 1000).toFixed(1)}k` : totalRecords}</p>
                <p className="text-xs text-stone-500 mt-0.5">Records</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/migration/new"
          className="group bg-amber-700 text-white rounded-xl p-6 shadow-sm hover:bg-amber-700 transition-colors flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base mb-1">Start New Migration</h3>
            <p className="text-sm text-amber-100 leading-relaxed">
              Upload your files and let AI map, deduplicate, and preview your data before anything imports.
            </p>
            <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-amber-200 group-hover:text-white">
              Choose your system <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link
          href="/migration/assisted"
          className="group bg-white border border-stone-200 rounded-xl p-6 shadow-sm hover:border-stone-300 transition-colors flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <HeartHandshake className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 text-base mb-1">Request Assisted Migration</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Let our migration specialists handle your data transfer. Ideal for complex or large datasets.
            </p>
            <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-stone-600 group-hover:text-stone-900">
              Request white-glove service <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* V1 Limitations Note */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">V1 Information</h4>
        <ul className="text-xs text-stone-500 space-y-1 list-disc list-inside">
          <li>File upload supports CSV and Excel only (ZIP extraction coming in V2)</li>
          <li>Image import for inventory not supported in V1</li>
          <li>Direct API sync (Shopify/Lightspeed live) deferred to V2 — file-based only</li>
          <li>Progress updates use 5-second polling (not real-time WebSockets)</li>
        </ul>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-stone-900">Recent Migrations</h2>
          <Link href="/migration/logs" className="text-sm text-stone-600 hover:text-stone-900">
            View all →
          </Link>
        </div>

        {!sessions || sessions.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
            <Package className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-600 text-sm font-medium">No migrations yet</p>
            <p className="text-stone-400 text-xs mt-1">Start your first migration to get going</p>
            <Link
              href="/migration/new"
              className="inline-flex items-center gap-2 mt-4 bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Start Migration <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const config = statusConfig[session.status] || statusConfig.draft;
              const step = getSessionStep(session.status);
              return (
                <Link
                  key={session.id}
                  href={`/migration/${session.id}/${step}`}
                  className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        {session.session_name || `${session.source_platform} Migration`}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5 capitalize">
                        {session.source_platform} · {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${config.color}`}>
                      {config.icon}
                      {config.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
