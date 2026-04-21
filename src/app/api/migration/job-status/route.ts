import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Launch-QA W5-CRIT-002: the GET and POST handlers previously looked up a
 * migration_jobs row by id only, with no tenant guard. Any authenticated
 * user could read the status of — or cancel — another tenant's migration
 * job by guessing/harvesting a job UUID. The fix: load the job, then
 * compare job.tenant_id to the caller's session-derived tenant before
 * returning or mutating.
 */

async function requireAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile?.tenant_id) return null;
  return { userId: user.id, tenantId: profile.tenant_id as string };
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await checkRateLimit(ip, 'heavy');
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const ctx = await requireAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (job.tenant_id !== ctx.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    const action = req.nextUrl.searchParams.get('action');

    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    const admin = createAdminClient();

    if (action === 'cancel') {
      // Scope by tenant as well as id so a cross-tenant cancel is impossible
      // even if the id collides or is guessed.
      const { data: existing } = await admin
        .from('migration_jobs')
        .select('tenant_id')
        .eq('id', jobId)
        .single();
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (existing.tenant_id !== ctx.tenantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await admin
        .from('migration_jobs')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('id', jobId)
        .eq('tenant_id', ctx.tenantId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
