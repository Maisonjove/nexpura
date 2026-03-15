import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    const admin = createAdminClient();
    const { data: job, error } = await admin
      .from('migration_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;

    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    const action = req.nextUrl.searchParams.get('action');

    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    const admin = createAdminClient();

    if (action === 'cancel') {
      await admin.from('migration_jobs').update({ status: 'failed', error_message: 'Cancelled by user' }).eq('id', jobId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
