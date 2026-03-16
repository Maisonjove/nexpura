'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressRing } from '../../_components/ProgressRing';
import { CheckCircle, AlertCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface JobStatus {
  id: string;
  status: string;
  total_records: number;
  processed_records: number;
  success_count: number;
  warning_count: number;
  error_count: number;
  skipped_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export default function ExecuteClient({ 
  sessionId, 
  jobId, 
  rt 
}: { 
  sessionId: string; 
  jobId?: string; 
  rt?: string 
}) {
  const router = useRouter();

  const [job, setJob] = useState<JobStatus | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    const res = await fetch(`/api/migration/job-status?jobId=${jobId}`);
    const data = await res.json();
    if (data.job) {
      setJob(data.job);
      if (data.job.status === 'complete' || data.job.status === 'failed') {
        setTimeout(() => {
          const rtSuffix = rt ? `?rt=${rt}` : '';
          router.push(`/migration/${sessionId}/results${rtSuffix}`);
        }, 2000);
      }
    }
  }, [jobId, sessionId, router, rt]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function handleCancel() {
    if (!jobId) return;
    await fetch(`/api/migration/job-status?jobId=${jobId}&action=cancel`, { method: 'POST' });
    setCancelled(true);
  }

  const progress = job && job.total_records > 0
    ? Math.round((job.processed_records / job.total_records) * 100)
    : 0;

  if (!jobId) {
    return (
      <div className="p-6 text-center">
        <p className="text-stone-500">No job ID provided.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Importing Your Data</h1>
        <p className="text-stone-500 text-sm mt-1">Please keep this window open until the import completes</p>
      </div>

      {/* Main progress */}
      <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-6">
        <ProgressRing
          progress={progress}
          size={140}
          label={job?.status === 'complete' ? 'Done!' : job?.status === 'failed' ? 'Failed' : 'Importing'}
          sublabel={job ? `${job.processed_records.toLocaleString()} / ${job.total_records.toLocaleString()}` : ''}
        />

        {job && (
          <div className="grid grid-cols-4 gap-4 w-full text-center">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-xl font-bold text-green-700">{job.success_count.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-0.5 flex items-center justify-center gap-1">
                <CheckCircle className="w-3 h-3" /> Success
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
              <p className="text-xl font-bold text-yellow-700">{job.warning_count.toLocaleString()}</p>
              <p className="text-xs text-yellow-600 mt-0.5 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" /> Warnings
              </p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xl font-bold text-red-600">{job.error_count.toLocaleString()}</p>
              <p className="text-xs text-red-500 mt-0.5 flex items-center justify-center gap-1">
                <XCircle className="w-3 h-3" /> Errors
              </p>
            </div>
            <div className="bg-stone-50 border border-stone-100 rounded-xl p-3">
              <p className="text-xl font-bold text-stone-600">{job.skipped_count.toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-0.5 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Skipped
              </p>
            </div>
          </div>
        )}

        {!job && (
          <div className="flex items-center gap-2 text-stone-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Initialising import...
          </div>
        )}

        {job?.status === 'complete' && (
          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
            <CheckCircle className="w-5 h-5" />
            Import complete! Redirecting to results...
          </div>
        )}

        {job?.status === 'failed' && (
          <div className="text-center">
            <p className="text-red-600 font-semibold text-sm">Import failed</p>
            {job.error_message && <p className="text-red-500 text-xs mt-1">{job.error_message}</p>}
          </div>
        )}

        {job && !['complete', 'failed'].includes(job.status) && !cancelled && progress < 80 && (
          <button
            onClick={handleCancel}
            className="text-xs text-stone-400 hover:text-stone-700 underline"
          >
            Cancel Import
          </button>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        Import is running in the background. This page auto-refreshes every 5 seconds. Redirecting automatically when complete.
      </div>
    </div>
  );
}
