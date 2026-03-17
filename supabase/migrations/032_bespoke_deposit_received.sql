-- 032_bespoke_deposit_received.sql
-- Ensure deposit_received column exists on bespoke_jobs
-- (may have been missed if table was created before this column was added to original migration)

ALTER TABLE public.bespoke_jobs
  ADD COLUMN IF NOT EXISTS deposit_received boolean DEFAULT false;
