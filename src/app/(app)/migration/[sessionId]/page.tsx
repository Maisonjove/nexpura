import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ sessionId: string }>;
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

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: session } = await admin
    .from('migration_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) redirect('/migration');

  const step = getRedirectStep(session.status);
  redirect(`/migration/${sessionId}/${step}`);
}
