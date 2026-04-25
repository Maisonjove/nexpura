-- Add lifecycle columns the transfers code already writes/reads but
-- that don't exist on the live schema (verified 2026-04-25 against
-- vkpjocnrefjfpuovzinn). Pre-fix every transfer
-- create / dispatch / receive call PGRST204'd → the entire feature
-- was unreachable. Tenants who tried to move stock between locations
-- saw an opaque error.
--
-- Columns added (matching what /api/inventory/transfers/{create,
-- dispatch,receive,cancel}/route.ts and /transfers/page.tsx already
-- expect):
--   stock_transfers.created_by        UUID  (who initiated)
--   stock_transfers.dispatched_at     TIMESTAMPTZ
--   stock_transfers.dispatched_by     UUID
--   stock_transfers.received_at       TIMESTAMPTZ
--   stock_transfers.received_by       UUID
--   stock_transfer_items.received_quantity INTEGER (partial-receive)
--
-- Idempotent — safe to re-apply.

ALTER TABLE public.stock_transfers
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.stock_transfer_items
  ADD COLUMN IF NOT EXISTS received_quantity INTEGER;

-- Backfill: existing in_transit rows lack dispatched_*; existing
-- completed rows lack received_*. Fill from completed_at +
-- transferred_by as a best-effort proxy so the transfers page renders
-- cleanly for legacy rows.
UPDATE public.stock_transfers
SET dispatched_at = COALESCE(dispatched_at, created_at),
    dispatched_by = COALESCE(dispatched_by, transferred_by)
WHERE status IN ('in_transit', 'completed');

UPDATE public.stock_transfers
SET received_at = COALESCE(received_at, completed_at),
    received_by = COALESCE(received_by, transferred_by)
WHERE status = 'completed';

UPDATE public.stock_transfer_items
SET received_quantity = quantity
WHERE received_quantity IS NULL
  AND transfer_id IN (SELECT id FROM public.stock_transfers WHERE status = 'completed');
