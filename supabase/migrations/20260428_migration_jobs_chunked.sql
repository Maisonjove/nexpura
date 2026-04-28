-- ============================================================
-- Background-job pattern for /api/migration/execute.
--
-- Pre-fix the lambda processed all rows synchronously and capped at
-- Vercel's 300s maxDuration — practical ceiling ~1500-2000 rows per
-- import. A jeweller migrating a 10k-row customer base would hit
-- the wall mid-import.
--
-- New pattern: each lambda processes one chunk (~1000 rows in
-- ~3min), persists its progress in migration_jobs, and dispatches
-- the next chunk via Next.js `after()` (which spawns a fresh
-- lambda with its own 300s budget). The client polls the existing
-- /api/migration/job-status endpoint as before.
--
-- Columns:
--   * current_file_index   — index into the (sorted) file list
--   * current_row_offset   — next row to process within that file
--   * internal_token       — opaque per-job secret; chunk-continue
--                            calls must present it (prevents
--                            external triggering of mid-import work)
-- ============================================================

ALTER TABLE public.migration_jobs
  ADD COLUMN IF NOT EXISTS current_file_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_row_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_token text;

COMMENT ON COLUMN public.migration_jobs.current_file_index IS
  'Background-job cursor: which file in the sorted list this job is currently chunking through.';
COMMENT ON COLUMN public.migration_jobs.current_row_offset IS
  'Background-job cursor: next row index within the current file.';
COMMENT ON COLUMN public.migration_jobs.internal_token IS
  'Per-job secret. Chunk-continue calls to /api/migration/execute must present this token to authorise mid-import work; prevents external triggering.';
