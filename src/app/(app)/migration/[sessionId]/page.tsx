import { Suspense } from "react";
import { redirect } from 'next/navigation';
import { getAuthOrReviewContext } from "@/lib/auth/review";

/**
 * /migration/[sessionId] — CC-ready redirect-only page.
 *
 * Whole page body is a redirect chain (resolve session → pick next step →
 * redirect). Under CC the top-level `await params` + `await searchParams` +
 * `await getAuthOrReviewContext()` (cookie read) would fire a HANGING_PROMISE
 * on the prerender pipeline. Wrapping in Suspense tells CC this subtree is
 * dynamic at request time. No visual skeleton because the user never sees
 * any rendered content — redirect() fires before any HTML flushes.
 *
 * TODO(cacheComponents-flag): no cacheable data here — the session-status
 * read and the subsequent redirect depend on request-time auth. Leave the
 * async logic as-is when the flag flips.
 */

interface Props {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ rt?: string }>;
}

function getRedirectStep(status: string): string {
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

export default function SessionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <SessionRedirectBody paramsPromise={params} searchParamsPromise={searchParams} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Resolves params + auth, performs the status-based redirect.
// ─────────────────────────────────────────────────────────────────────────
async function SessionRedirectBody({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ sessionId: string }>;
  searchParamsPromise: Promise<{ rt?: string }>;
}) {
  const { sessionId } = await paramsPromise;
  const { rt } = await searchParamsPromise;
  const { tenantId, admin } = await getAuthOrReviewContext(rt);

  if (!tenantId) redirect('/login');

  const { data: session } = await admin
    .from('migration_sessions')
    .select('status')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!session) redirect('/migration');

  const step = getRedirectStep(session.status);
  const rtSuffix = rt ? `?rt=${rt}` : '';
  redirect(`/migration/${sessionId}/${step}${rtSuffix}`);
}
