import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeBearerMatch } from '@/lib/timing-safe-compare';
import { runChunkContinue } from '@/lib/migration/chunk-runner';
import logger from '@/lib/logger';

export const maxDuration = 300;

/**
 * Cron-driven migration chunk runner.
 *
 * Chain-style chunk dispatch (lambda → lambda fetch) proved
 * unreliable on Vercel: the after() pattern lost outbound
 * fetches once the dispatching lambda terminated, and
 * `keepalive: true` did not rescue it. Both failure modes were
 * silent — chunk N+1 never started, the job stuck forever at
 * row N×CHUNK_SIZE.
 *
 * This cron runs every minute, picks the OLDEST migration_jobs
 * row with status='running' that hasn't been touched in >30s,
 * and synthesises an internal call into runChunkContinue with
 * the job's persisted internal_token. That advances the cursor
 * by one chunk (~1000 rows / ~3 min). Next minute the cron
 * picks up the same job and runs the next chunk. Etc. Worst-
 * case latency between chunks is the cron interval (~1 min) +
 * processing (~3 min) = ~4 min per chunk = ~40 min for 10k
 * rows. Acceptable.
 *
 * Concurrency guard: takes the oldest stale job. If a job was
 * already started in the last minute (status=running but
 * updated_at recent), we skip it — avoids two crons racing on
 * the same job. The stale window (>30s without update) gives
 * the in-flight chunk room to actually be in-flight without
 * being preempted.
 */
export const GET = withSentryFlush(async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization');
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Atomically claim the oldest stale 'running' job via the RPC,
  // which uses FOR UPDATE SKIP LOCKED inside a CTE so concurrent
  // crons can never read the same row. Pre-fix the cron used a
  // plain SELECT + ordering, which raced with the in-process
  // dispatchNextChunk and produced 4162 duplicate customer rows
  // on the first 10k test (10000 distinct emails, 14162 rows).
  const { data: claimed, error: claimErr } = await admin.rpc('claim_migration_chunk', {
    p_chunk_max_seconds: 300,
  });
  if (claimErr) {
    logger.error('[cron migration-chunk-runner] claim_migration_chunk failed', { error: claimErr });
    return NextResponse.json({ error: 'claim failed' }, { status: 500 });
  }
  const job = claimed as { id: string; internal_token: string | null } | null;
  if (!job || !job.id) {
    return NextResponse.json({ ok: true, picked: 0 });
  }
  if (!job.internal_token) {
    logger.warn('[cron migration-chunk-runner] claimed job missing internal_token', { jobId: job.id });
    return NextResponse.json({ ok: false, error: 'job missing internal_token', jobId: job.id });
  }

  // Synthesise a NextRequest pointing at /api/migration/execute-chunk
  // so runChunkContinue can use req.nextUrl.origin for any further
  // dispatches. (We keep dispatchNextChunk in the chunk-runner as a
  // best-effort optimization; if it works, great — chunks chain
  // back-to-back with no cron latency. If it doesn't, this cron
  // picks up the slack.)
  const origin = request.nextUrl.origin;
  const synthRequest = new NextRequest(`${origin}/api/migration/execute-chunk`, {
    method: 'POST',
  });

  try {
    const res = await runChunkContinue(synthRequest, {
      jobId: job.id,
      internalToken: job.internal_token,
    });
    const status = res.status;
    return NextResponse.json({
      ok: true,
      picked: 1,
      jobId: job.id,
      chunk_response_status: status,
    });
  } catch (e) {
    logger.error('[cron migration-chunk-runner] runChunkContinue threw', {
      jobId: job.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({
      ok: false,
      jobId: job.id,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
});
