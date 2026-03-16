import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MigrationStepper } from '../../_components/MigrationStepper';
import { MappingTableWrapper } from './MappingTableWrapper';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ rt?: string }>;
}

export default async function MappingPage({ params, searchParams }: Props) {
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

  const { data: mappings } = await admin
    .from('migration_mappings')
    .select('*, migration_files(original_name, detected_entity, row_count)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/migration/${sessionId}/files`} className="text-stone-400 hover:text-stone-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Review Field Mappings</h1>
            <p className="text-stone-500 text-sm">AI has proposed these mappings — review and adjust if needed</p>
          </div>
        </div>
        <MigrationStepper sessionId={sessionId} currentStep={2} />
      </div>

      <MappingTableWrapper
        sessionId={sessionId}
        mappings={mappings || []}
      />
    </div>
  );
}
