-- =====================================================
-- Public token kill-switch: tracking_revoked_at
-- Audit finding (Medium): after a repair/bespoke was cancelled or the
-- jeweller wanted to revoke customer access, the public /track/[id]
-- URL still resolved. No column existed to mark a tracking link as
-- revoked short of changing the tracking_id itself.
--
-- Fix: add `tracking_revoked_at timestamptz` to both tables; /track/[id]
-- treats a set timestamp the same as "order not found" so the customer
-- lands on the branded invalid-state page.
-- =====================================================

ALTER TABLE public.repairs       ADD COLUMN IF NOT EXISTS tracking_revoked_at timestamptz;
ALTER TABLE public.bespoke_jobs  ADD COLUMN IF NOT EXISTS tracking_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_repairs_tracking_revoked
  ON public.repairs (tenant_id) WHERE tracking_revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bespoke_tracking_revoked
  ON public.bespoke_jobs (tenant_id) WHERE tracking_revoked_at IS NOT NULL;

COMMENT ON COLUMN public.repairs.tracking_revoked_at IS
  'When set, the /track/[tracking_id] public URL renders Order Not Found. Use when cancelling a repair or responding to a customer privacy request.';
COMMENT ON COLUMN public.bespoke_jobs.tracking_revoked_at IS
  'Same semantics as repairs.tracking_revoked_at.';
