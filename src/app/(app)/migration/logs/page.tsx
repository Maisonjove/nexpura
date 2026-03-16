import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';

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

function getStep(status: string): string {
  const map: Record<string, string> = {
    draft: 'files', files_uploaded: 'mapping', mapping: 'mapping',
    preview: 'preview', executing: 'execute', complete: 'results', failed: 'results', cancelled: 'files',
  };
  return map[status] || 'files';
}

export default async function MigrationLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  const { data: sessions } = await admin
    .from('migration_sessions')
    .select('*')
    .eq('tenant_id', profile?.tenant_id)
    .order('created_at', { ascending: false });

  // Get job stats for each session
  const { data: jobs } = await admin
    .from('migration_jobs')
    .select('session_id, success_count, total_records, status')
    .in('session_id', (sessions || []).map(s => s.id));

  const jobMap = new Map<string, { session_id: any; success_count: any; total_records: any; status: any }>();
  for (const j of (jobs || [])) {
    jobMap.set(j.session_id, j);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/migration" className="text-stone-400 hover:text-stone-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Migration History</h1>
            <p className="text-stone-500 text-sm">All migration sessions for your account</p>
          </div>
        </div>
        <Link
          href="/migration/new"
          className="flex items-center gap-2 bg-[#B45309] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
        >
          New Migration
        </Link>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        {!sessions || sessions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-stone-500 text-sm">No migrations found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Session</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Records</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sessions.map((session) => {
                const config = statusConfig[session.status] || statusConfig.draft;
                const job = jobMap.get(session.id);
                const step = getStep(session.status);
                return (
                  <tr key={session.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">
                        {session.session_name || `${session.source_platform} Migration`}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5 capitalize">{session.mode} mode</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-stone-700">{session.source_platform}</span>
                    </td>
                    <td className="px-4 py-3">
                      {job ? (
                        <span className="text-stone-700">{(job.success_count || 0).toLocaleString()} / {(job.total_records || 0).toLocaleString()}</span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit text-xs font-semibold px-2 py-1 rounded-full ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/migration/${session.id}/${step}`}
                        className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
