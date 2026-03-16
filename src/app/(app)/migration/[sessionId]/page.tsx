import { redirect } from 'next/navigation';
import { getAuthOrReviewContext } from "@/lib/auth/review";

export const dynamic = 'force-dynamic';

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

export default async function SessionPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const { rt } = await searchParams;
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
