-- ============================================================
-- Add updated_at column + trigger to migration_jobs.
--
-- Required by the cron-driven chunk runner
-- (/api/cron/migration-chunk-runner). The cron picks up jobs whose
-- updated_at is older than 30s — i.e. they haven't shown activity
-- recently — and runs the next chunk.
--
-- Without this column the cron's `.lt('updated_at', cutoff)` errors
-- and no chunk ever fires. The job sits in 'running' status until
-- the in-process dispatchNextChunk eventually wakes it up (which is
-- unreliable on Vercel — see PR #71/72/74 history).
-- ============================================================

ALTER TABLE public.migration_jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_migration_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS migration_jobs_set_updated_at ON public.migration_jobs;
CREATE TRIGGER migration_jobs_set_updated_at
  BEFORE UPDATE ON public.migration_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_migration_jobs_updated_at();
