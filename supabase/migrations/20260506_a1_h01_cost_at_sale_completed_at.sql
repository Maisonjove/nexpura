-- A1 cluster Day 4 (2026-05-06): H-01 margin formula + completed_at.
--
-- Two columns added:
--
--   sale_items.cost_at_sale  — snapshot of inventory.cost_price at the
--   moment the sale_item is written. NEVER mutated by retroactive
--   inventory cost edits. Margin formula reads from here, not from
--   the live inventory.cost_price column. Pre-fix: a cost edit on
--   inventory after a sale silently changed the historical margin
--   for that sale (e.g. a reprice of a $100 item from $50 cost to
--   $40 cost retroactively turned a 50% margin into 60%). With this
--   column, the historical sale's margin is locked at write time.
--
--   sales.completed_at       — timestamp when sale.status moved to
--   'paid' or 'completed'. EOD aggregator (C-03 v2) reads this in
--   tenant timezone for accurate day boundaries. Pre-fix the EOD
--   path used `sale_date` (the user-supplied display date) which
--   could drift from the actual completion time.
--
-- Backfill strategy:
--
--   cost_at_sale: populate from inventory.cost_price for sale_items
--   where inventory_id is set. For sale_items with no inventory_id
--   (manual line items, custom work) leave NULL; the margin formula
--   handles NULL as "unknown" and surfaces a warning in the UI
--   rather than computing a misleading margin.
--
--   completed_at: populate from updated_at for sales already in
--   'paid' or 'completed' status (best available proxy for "when
--   the sale completed"). For 'quote' / 'confirmed' / 'cancelled'
--   leave NULL — those weren't completed.
--
-- Both columns are nullable to allow incremental rollout. Future
-- writes (post-merge of A1) populate them at insert/update time;
-- backfill catches the historical rows.

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. sale_items.cost_at_sale — H-01 margin snapshot
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC(12,2);

COMMENT ON COLUMN public.sale_items.cost_at_sale IS
  'A1 H-01 (2026-05-06): snapshot of inventory.cost_price at sale-write '
  'time. Locked at write — NEVER mutated by retroactive inventory cost '
  'edits. Margin formula reads from here, not the live cost_price. '
  'NULL for sale_items with no inventory_id (custom/manual lines) — '
  'margin is "unknown" rather than misleading.';

-- Backfill from inventory.cost_price for rows where inventory_id is set.
-- Skip rows that already have cost_at_sale (idempotent re-run).
UPDATE public.sale_items si
   SET cost_at_sale = inv.cost_price
  FROM public.inventory inv
 WHERE si.inventory_id = inv.id
   AND si.cost_at_sale IS NULL
   AND inv.cost_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS sale_items_cost_at_sale_partial_idx
  ON public.sale_items (sale_id)
  WHERE cost_at_sale IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. sales.completed_at — C-03 / H-02 day-boundary canonical column
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sales.completed_at IS
  'A1 H-01 (2026-05-06): timestamp when sale.status moved to '
  '''paid'' or ''completed''. EOD aggregator (C-03 v2) reads this in '
  'tenant timezone for accurate day boundaries — replaces the '
  'previous reliance on user-supplied sale_date. NULL for quote / '
  'confirmed / cancelled / refunded states.';

-- Backfill: for sales already in paid/completed status, set
-- completed_at = updated_at (best proxy). For other statuses leave
-- NULL — reverse-fill at the API layer when status changes.
UPDATE public.sales
   SET completed_at = updated_at
 WHERE completed_at IS NULL
   AND status IN ('paid', 'completed')
   AND updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_completed_at_partial_idx
  ON public.sales (tenant_id, completed_at)
  WHERE completed_at IS NOT NULL;

COMMIT;
