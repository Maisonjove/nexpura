import Link from 'next/link';
import { getAuthOrReviewContext } from "@/lib/auth/review";
import {
  ArrowRightIcon,
  ArrowUpTrayIcon,
  HeartIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { TrustBadges } from './_components/TrustBadges';

export const metadata = { title: "Migration Hub — Nexpura" };

const statusBadge: Record<string, string> = {
  draft: "nx-badge-neutral",
  files_uploaded: "nx-badge-warning",
  mapping: "nx-badge-warning",
  preview: "nx-badge-warning",
  executing: "nx-badge-neutral",
  complete: "nx-badge-success",
  failed: "nx-badge-danger",
  cancelled: "nx-badge-neutral",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  files_uploaded: "Files Uploaded",
  mapping: "Mapping",
  preview: "Preview",
  executing: "Importing",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

const statusIcon: Record<string, React.ReactNode> = {
  draft: <ClockIcon className="w-3 h-3" strokeWidth={1.5} />,
  files_uploaded: <ClockIcon className="w-3 h-3" strokeWidth={1.5} />,
  mapping: <ClockIcon className="w-3 h-3" strokeWidth={1.5} />,
  preview: <ClockIcon className="w-3 h-3" strokeWidth={1.5} />,
  executing: <ClockIcon className="w-3 h-3" strokeWidth={1.5} />,
  complete: <CheckCircleIcon className="w-3 h-3" strokeWidth={1.5} />,
  failed: <XCircleIcon className="w-3 h-3" strokeWidth={1.5} />,
  cancelled: <XCircleIcon className="w-3 h-3" strokeWidth={1.5} />,
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

export default async function MigrationHubPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string }>;
}) {
  const params = await searchParams;
  const { tenantId, admin: adminClient } = await getAuthOrReviewContext(params.rt);

  if (!tenantId) {
    return (
      <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12 flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-stone-500 mb-4">Please sign in to access the Migration Hub.</p>
          <Link href="/login" className="nx-btn-primary inline-flex">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const { data: sessions } = await adminClient
    .from('migration_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  const activeSessions = sessions?.filter(s => !['complete', 'failed', 'cancelled'].includes(s.status)) || [];
  const completedSessions = sessions?.filter(s => s.status === 'complete') || [];

  const { data: jobStats } = await adminClient
    .from('migration_jobs')
    .select('success_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'complete');

  const totalRecords = jobStats?.reduce((sum, j) => sum + (j.success_count || 0), 0) || 0;
  const totalRecordsLabel = totalRecords > 1000 ? `${(totalRecords / 1000).toFixed(1)}k` : totalRecords;

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-[0.75rem] tracking-luxury uppercase text-stone-400 mb-3">
            Onboarding
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.05] mb-4">
            Migration Hub
          </h1>
          <p className="text-stone-500 text-base leading-relaxed max-w-2xl">
            AI-powered migration concierge. Switch from any jewellery POS — Swim, Jewel360, WJewel, Shopify, and more — with intelligent field mapping, duplicate detection, and a full preview before anything imports.
          </p>
          <div className="mt-6">
            <TrustBadges />
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden mb-12">
          {[
            { label: "Active", value: activeSessions.length },
            { label: "Complete", value: completedSessions.length },
            { label: "Records", value: totalRecordsLabel },
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-6 py-7 sm:px-8">
              <p className="text-[0.6875rem] tracking-luxury uppercase text-stone-400 mb-3">
                {stat.label}
              </p>
              <p className="font-serif text-3xl sm:text-4xl tabular-nums tracking-tight text-stone-900 leading-none">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* CTA cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          <Link
            href="/migration/new"
            className="group bg-nexpura-charcoal text-white rounded-2xl p-7 transition-all duration-400 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex items-start gap-4"
          >
            <ArrowUpTrayIcon className="w-6 h-6 text-nexpura-bronze-light flex-shrink-0 mt-1" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-xl tracking-tight mb-2">
                Start New Migration
              </h3>
              <p className="text-[0.875rem] text-stone-300 leading-relaxed">
                Upload your files and let AI map, deduplicate, and preview your data before anything imports.
              </p>
              <div className="flex items-center gap-1 mt-4 text-[0.75rem] tracking-luxury uppercase text-nexpura-bronze-light group-hover:text-white transition-colors">
                Choose your system
                <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.5} />
              </div>
            </div>
          </Link>

          <Link
            href="/migration/assisted"
            className="group bg-white border border-stone-200 rounded-2xl p-7 transition-all duration-400 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 flex items-start gap-4"
          >
            <HeartIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze flex-shrink-0 mt-1 transition-colors" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-xl tracking-tight text-stone-900 mb-2">
                Request Assisted Migration
              </h3>
              <p className="text-[0.875rem] text-stone-500 leading-relaxed">
                Let our migration specialists handle your data transfer. Ideal for complex or large datasets.
              </p>
              <div className="flex items-center gap-1 mt-4 text-[0.75rem] tracking-luxury uppercase text-stone-500 group-hover:text-nexpura-bronze transition-colors">
                Request white-glove service
                <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.5} />
              </div>
            </div>
          </Link>
        </div>

        {/* V1 note */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-12">
          <p className="text-[0.6875rem] tracking-luxury uppercase text-stone-400 mb-3">
            V1 Information
          </p>
          <ul className="text-sm text-stone-500 space-y-2 list-disc list-inside leading-relaxed">
            <li>File upload supports CSV and Excel (.xlsx) formats</li>
            <li>Image import for inventory not supported in V1</li>
            <li>File-based import only — live API sync available on request for enterprise accounts</li>
            <li>Progress updates use 5-second polling (not real-time WebSockets)</li>
          </ul>
        </div>

        {/* Recent sessions */}
        <div>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[0.6875rem] tracking-luxury uppercase text-stone-400 mb-2">
                Archive
              </p>
              <h2 className="font-serif text-2xl tracking-tight text-stone-900">
                Recent migrations
              </h2>
            </div>
            <Link
              href="/migration/logs"
              className="text-sm text-stone-500 hover:text-nexpura-bronze transition-colors"
            >
              View all →
            </Link>
          </div>

          {!sessions || sessions.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl py-16 text-center">
              <ArchiveBoxIcon
                className="w-10 h-10 text-stone-300 mx-auto mb-5"
                strokeWidth={1.5}
              />
              <h3 className="font-serif text-2xl tracking-tight text-stone-900 mb-2">
                No migrations yet
              </h3>
              <p className="text-stone-500 text-sm mb-7">
                Start your first migration to get going.
              </p>
              <Link
                href="/migration/new"
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                Start Migration
                <ArrowRightIcon className="w-4 h-4" strokeWidth={1.5} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const step = getSessionStep(session.status);
                return (
                  <Link
                    key={session.id}
                    href={`/migration/${session.id}/${step}`}
                    className="group flex items-center justify-between bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300"
                  >
                    <div>
                      <p className="font-serif text-lg tracking-tight text-stone-900">
                        {session.session_name || `${session.source_platform} Migration`}
                      </p>
                      <p className="text-[0.8125rem] text-stone-500 mt-1 capitalize">
                        {session.source_platform} · <span className="tabular-nums">{new Date(session.created_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`${statusBadge[session.status] || "nx-badge-neutral"} inline-flex items-center gap-1`}>
                        {statusIcon[session.status]}
                        {statusLabel[session.status] || session.status}
                      </span>
                      <ArrowRightIcon
                        className="w-4 h-4 text-stone-300 group-hover:text-nexpura-bronze group-hover:translate-x-0.5 transition-all"
                        strokeWidth={1.5}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
