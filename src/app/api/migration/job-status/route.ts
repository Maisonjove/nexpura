import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from "@/lib/rate-limit";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
