import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { MigrationStepper } from '../../_components/MigrationStepper';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function DuplicatesPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/migration/${sessionId}/mapping`} className="text-stone-400 hover:text-stone-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Duplicate Review</h1>
            <p className="text-stone-500 text-sm">Review potential duplicates before importing</p>
          </div>
        </div>
        <MigrationStepper sessionId={sessionId} currentStep={2} />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
        <Users className="w-8 h-8 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-700 font-semibold text-sm">No duplicates detected</p>
        <p className="text-stone-400 text-xs mt-1">AI scan found no duplicate customers, inventory, or records in your upload.</p>
        <div className="mt-6">
          <Link
            href={`/migration/${sessionId}/preview`}
            className="inline-flex items-center gap-2 bg-[#B45309] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-amber-700 transition-colors"
          >
            Continue to Preview
          </Link>
        </div>
      </div>
    </div>
  );
}
