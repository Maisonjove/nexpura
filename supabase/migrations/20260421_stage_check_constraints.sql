-- =====================================================
-- CHECK constraints on repairs.stage + bespoke_jobs.stage
-- Audit finding (High): both columns were unchecked TEXT, so a typo
-- in any refactor or a direct DB update could land `stage='reafy'` or
-- `stage='picked_up'` from 'intake' without passing through
-- in_progress/ready. Dashboard counts + status emails depend on the
-- stage value being within a known set.
--
-- Values allowed were discovered by scanning the current distinct set
-- in the live DB (see audit). We take the union as the accepted list
-- rather than narrowing aggressively — aggressive narrowing would
-- reject existing rows. Future cleanup can tighten these.
-- =====================================================

-- repairs.stage: observed live values were
--   intake, quoted, in_progress, collected, approved, assessed,
--   completed, ready
-- Adding expected-future values: picked_up, cancelled, on_hold
ALTER TABLE public.repairs
  DROP CONSTRAINT IF EXISTS repairs_stage_valid;
ALTER TABLE public.repairs
  ADD CONSTRAINT repairs_stage_valid
  CHECK (stage IN (
    'intake', 'assessed', 'quoted', 'approved', 'in_progress',
    'ready', 'collected', 'picked_up', 'completed', 'cancelled', 'on_hold'
  ));

-- bespoke_jobs.stage: observed live values were
--   enquiry, consultation, intake, design, in_progress, quoted,
--   assessed, approved, ready
-- Adding: delivered, cancelled, on_hold
ALTER TABLE public.bespoke_jobs
  DROP CONSTRAINT IF EXISTS bespoke_jobs_stage_valid;
ALTER TABLE public.bespoke_jobs
  ADD CONSTRAINT bespoke_jobs_stage_valid
  CHECK (stage IN (
    'enquiry', 'consultation', 'intake', 'design', 'design_review',
    'assessed', 'quoted', 'approved', 'in_progress', 'ready',
    'collected', 'delivered', 'completed', 'cancelled', 'on_hold'
  ));

COMMENT ON CONSTRAINT repairs_stage_valid ON public.repairs IS
  'Prevents typos / out-of-enum stage writes. If you need a new stage, add it to this list via migration, not by relaxing the constraint.';
COMMENT ON CONSTRAINT bespoke_jobs_stage_valid ON public.bespoke_jobs IS
  'Same policy as repairs_stage_valid.';
