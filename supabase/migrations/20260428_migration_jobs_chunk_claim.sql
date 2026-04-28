-- ============================================================
-- Long-held cron claim for migration chunks.
--
-- Pre-fix the previous claim_migration_chunk RPC just bumped
-- updated_at — the row-lock was only held during the UPDATE.
-- After the cron's call returned, the chunk processed for ~3min
-- WITHOUT a held lock. If processChunkOfRows had any pause >30s
-- (slow Supabase round-trip, batch insert backoff, etc), the next
-- cron tick saw updated_at as stale and claimed the same job —
-- two concurrent crons running the same chunk → duplicate inserts.
--
-- Observed on the second 10k test: 15711 customer rows for 10000
-- distinct emails (5711 dup rows), all clustered around the 7000-
-- row mark — exactly where a Supabase round-trip likely stalled.
--
-- Fix: a long-held claim. The cron sets
-- `chunk_claim_until = now() + 5min` when it picks up a job. Other
-- crons skip rows whose chunk_claim_until is still in the future.
-- The chunk runner explicitly clears chunk_claim_until at the END
-- of every successful chunk so the next cron tick picks up
-- immediately (no waiting for the 5min expiry).
--
-- A failed/dead chunk leaves chunk_claim_until in the future for
-- up to 5min — this is the "auto-recovery" window. After that
-- another cron tick reclaims and retries.
-- ============================================================

ALTER TABLE public.migration_jobs
  ADD COLUMN IF NOT EXISTS chunk_claim_until timestamptz;

DROP FUNCTION IF EXISTS public.claim_migration_chunk(integer);

CREATE OR REPLACE FUNCTION public.claim_migration_chunk(
  p_chunk_max_seconds integer DEFAULT 300
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
      AND (chunk_claim_until IS NULL OR chunk_claim_until < now())
      AND internal_token IS NOT NULL
    ORDER BY started_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.migration_jobs
     SET chunk_claim_until = now() + (p_chunk_max_seconds || ' seconds')::interval,
         updated_at = now()
    FROM candidate
   WHERE migration_jobs.id = candidate.id
  RETURNING migration_jobs.* INTO v_job;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_migration_chunk(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_migration_chunk(integer) TO service_role;
