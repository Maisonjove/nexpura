-- =====================================================
-- Dedupe stage enums: collapse two names that mean the same thing.
--
-- Audit finding (Medium, M-stage-dup-repairs):
--   repairs.stage  allowed BOTH 'collected' and 'picked_up' — same
--   concept, two spellings. Any row that landed as 'picked_up' skipped
--   the dashboard's "collected" bucket + the customer-facing tracking
--   label mapping. Canonical value: 'collected'.
--
--   bespoke_jobs.stage allowed BOTH 'collected' and 'delivered' — same
--   terminal "customer has it" state. Canonical value: 'collected',
--   matching repairs so one status-strip render path handles both.
--
-- This migration:
--   1. Migrates any existing rows (idempotent — safe to re-run).
--   2. Rewrites the CHECK constraint to drop the duplicate spelling.
--
-- Run count against prod before applying: 0 'picked_up' repairs, 0
-- 'delivered' bespoke jobs — so this is a constraint-only change in
-- practice, but we include the UPDATE so the migration is correct for
-- any environment that DOES have the old value.
-- =====================================================

-- 1a. Migrate existing repairs data
UPDATE public.repairs
   SET stage = 'collected'
 WHERE stage = 'picked_up';

-- 1b. Migrate existing bespoke_jobs data
UPDATE public.bespoke_jobs
   SET stage = 'collected'
 WHERE stage = 'delivered';

-- 2a. Tighten repairs.stage CHECK constraint — remove 'picked_up'.
-- Transitions between these values are NOT enforced in the DB; the
-- application layer owns that. See comment on the constraint.
ALTER TABLE public.repairs
  DROP CONSTRAINT IF EXISTS repairs_stage_valid;
ALTER TABLE public.repairs
  ADD CONSTRAINT repairs_stage_valid
  CHECK (stage IN (
    'intake', 'assessed', 'quoted', 'approved', 'in_progress',
    'ready', 'collected', 'completed', 'cancelled', 'on_hold'
  ));

-- 2b. Tighten bespoke_jobs.stage CHECK constraint — remove 'delivered'.
ALTER TABLE public.bespoke_jobs
  DROP CONSTRAINT IF EXISTS bespoke_jobs_stage_valid;
ALTER TABLE public.bespoke_jobs
  ADD CONSTRAINT bespoke_jobs_stage_valid
  CHECK (stage IN (
    'enquiry', 'consultation', 'intake', 'design', 'design_review',
    'assessed', 'quoted', 'approved', 'in_progress', 'ready',
    'collected', 'completed', 'cancelled', 'on_hold'
  ));

COMMENT ON CONSTRAINT repairs_stage_valid ON public.repairs IS
  'Prevents typos / out-of-enum stage writes. Transitions between '
  'values are enforced at the application layer, not the DB. If DB-'
  'level transition enforcement is ever needed, add a trigger in a '
  'separate migration.';
COMMENT ON CONSTRAINT bespoke_jobs_stage_valid ON public.bespoke_jobs IS
  'Same policy as repairs_stage_valid. Transitions enforced by the app.';
