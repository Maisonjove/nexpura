import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  entitySortKey,
  type MigrationFile,
  type MigrationSession,
} from '@/lib/migration/chunk-runner';
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

export const maxDuration = 300;

export const POST = withSentryFlush(async (req: NextRequest) => {
  const admin = createAdminClient();
  try {
    const body = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit migration executions per user AND per tenant. The
    // per-tenant guard closes the audit's TOCTOU race window where two
    // owner/admins on the same tenant could each kick off a concurrent
    // import and the SELECT-then-INSERT dedupe in findDuplicateCustomer
    // could allow two rows for the same email (no DB-level unique
    // constraint exists on (tenant_id, lower(email))).
    const { success: userRateOk } = await checkRateLimit(`migration-execute:user:${user.id}`, 'heavy');
    if (!userRateOk) {
      return NextResponse.json({ error: 'Migration already in progress. Please wait before starting another.' }, { status: 429 });
    }

    // SECURITY: use admin client — anon client triggers RLS recursion on users
    // table, which can return null and leave tenantId undefined, causing all
    // subsequent inserts to run without a tenant_id.
    const { data: profile } = await admin
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    const tenantId = (profile as { tenant_id: string } | null)?.tenant_id;

    // Hard-fail if tenant cannot be resolved — never proceed with undefined tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 403 });
    }

    // Migration execute does bulk writes across customers / inventory /
    // repairs / invoices etc. Owner/admin only — staff have no reason to
    // trigger a multi-hundred-row import against the tenant.
    const role = (profile as { role?: string } | null)?.role ?? 'staff';
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Per-tenant rate limit (closes the TOCTOU race — see comment above).
    const { success: tenantRateOk } = await checkRateLimit(`migration-execute:tenant:${tenantId}`, 'heavy');
    if (!tenantRateOk) {
      return NextResponse.json({ error: 'Another import is already running for this tenant. Wait for it to finish before starting another.' }, { status: 429 });
    }

    const parseResult = (await import('@/lib/schemas')).migrationExecuteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }
    const { sessionId } = parseResult.data;

    // SECURITY: enforce tenant ownership on session lookup.
    // Without .eq('tenant_id', tenantId), an authenticated user from Tenant A
    // could supply Tenant B's sessionId and read/execute their migration files.
    const { data: sessionData } = await admin
      .from('migration_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();

    const session = sessionData as MigrationSession | null;
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Audit fix: session-level replay guard. The migration_files filter
    // below skips already-imported files (they transition to
    // status='imported'), so a re-execute on a successful session
    // becomes a no-op the user can't distinguish from success. For
    // sessions in 'complete' / 'complete_with_errors', refuse outright
    // so the operator must create a new session — otherwise repairs/
    // bespoke jobs (no unique constraint) could duplicate if a partial
    // file got re-processed via a status edge case.
    const sessionStatus = (session as { status?: string }).status;
    if (sessionStatus === 'complete' || sessionStatus === 'complete_with_errors') {
      return NextResponse.json({
        error: `Migration session already executed (status=${sessionStatus}). Create a new session to re-run.`,
      }, { status: 409 });
    }

    const { data: rawFiles } = await admin
      .from('migration_files')
      .select('*, migration_mappings(*)')
      .eq('session_id', sessionId)
      .in('status', ['classified', 'ready', 'pending']);

    const files = (rawFiles ?? []) as MigrationFile[];
    const sortedFiles = [...files].sort((a, b) =>
      entitySortKey(a.detected_entity ?? 'unknown') - entitySortKey(b.detected_entity ?? 'unknown')
    );
    const totalRecords = sortedFiles.reduce((sum, f) => sum + (f.row_count || 0), 0);

    // Per-job secret. Chunk-continue calls must echo this back.
    // Stored on the job row only — the client never sees it (the
    // /api/migration/job-status route doesn't have to filter it
    // out for status reads, but if we end up serialising the full
    // row anywhere we should).
    const internalToken = randomUUID();

    const { data: jobData, error: jobError } = await admin
      .from('migration_jobs')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        status: 'running',
        total_records: totalRecords,
        processed_records: 0,
        success_count: 0,
        warning_count: 0,
        error_count: 0,
        skipped_count: 0,
        current_file_index: 0,
        current_row_offset: 0,
        internal_token: internalToken,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const job = jobData as { id: string };

    await admin.from('migration_logs').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      job_id: job.id,
      actor_id: user.id,
      action: 'job_started',
      details: { total_records: totalRecords, source_platform: session.source_platform },
    });

    // Edge case: session has no files to process. Mark complete
    // immediately so the polling client doesn't spin forever.
    if (sortedFiles.length === 0) {
      await admin.from('migration_jobs').update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        results_summary: { by_entity: {}, total_processed: 0, total_success: 0, total_errors: 0, total_skipped: 0, total_duplicates: 0 },
      }).eq('id', job.id);
      await admin.from('migration_sessions').update({
        status: 'complete',
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
      return NextResponse.json({ jobId: job.id, success: true });
    }

    // No in-process dispatch. The cron at /api/cron/migration-chunk-
    // runner picks up the job on its next tick (≤60s). Pre-fix the
    // first-call dispatched the first chunk synchronously, but the
    // in-process pattern raced with the cron and produced duplicate
    // rows on the 10k test (10000 distinct emails, 14162 rows).
    // Cron is now the sole driver, gated by an atomic claim_migration
    // _chunk RPC using FOR UPDATE SKIP LOCKED.
    return NextResponse.json({
      jobId: job.id,
      success: true,
    });
  } catch (err: unknown) {
    logger.error('Execute error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
