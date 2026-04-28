-- ============================================================
-- Atomic claim function for the cron-driven chunk runner.
--
-- Pre-fix the cron picked the oldest stale 'running' job via a
-- plain SELECT + LIMIT 1 with no row lock. Two concurrent crons
-- (or cron + the in-process fire-and-forget dispatch) could both
-- read the same job, both run a chunk against the same cursor,
-- and insert duplicate rows. Observed in the 10k test: 14162
-- customer rows for 10000 distinct emails (4162 duplicates).
--
-- This RPC uses FOR UPDATE SKIP LOCKED inside a CTE so only one
-- caller wins the row. The losing caller either gets a different
-- row (if multiple jobs are stale) or NULL (if only one and it's
-- locked).
--
-- The matching application change in /api/cron/migration-chunk-
-- runner removes the plain SELECT and calls this RPC instead.
-- The in-process dispatchNextChunk in chunk-runner.ts is also
-- removed so cron is the sole driver.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_migration_chunk(
  p_stale_window_seconds integer DEFAULT 30
)
RETURNS public.migration_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.migration_jobs;
BEGIN
  WITH candidate AS (
    SELECT id
    FROM public.migration_jobs
    WHERE status = 'running'
      AND updated_at < now() - (p_stale_window_seconds || ' seconds')::interval
      AND internal_token IS NOT NULL
    ORDER BY started_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.migration_jobs
     SET updated_at = now()
    FROM candidate
   WHERE migration_jobs.id = candidate.id
  RETURNING migration_jobs.* INTO v_job;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_migration_chunk(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_migration_chunk(integer) TO service_role;
