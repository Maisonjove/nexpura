-- Three columns the code references but the live schema doesn't expose
-- (verified 2026-04-25 against vkpjocnrefjfpuovzinn).
--
-- 1. suppliers.deleted_at — code currently HARD-deletes. FK columns
--    on inventory.supplier_id, purchase_orders.supplier_id,
--    memo_items.supplier_id are ON DELETE SET NULL, so deleting a
--    supplier silently severs every historical purchase record from
--    its source. Soft-delete preserves the audit trail.
--
-- 2. repairs.intake_notes / repairs.workshop_notes — referenced in
--    src/app/(app)/repairs/[id]/page.tsx, RepairCommandCenter.tsx,
--    and components/types.ts. The select("*") returns rows without
--    these keys today, so reads `?? null` cleanly to null and the
--    UI just hides the notes blocks. But any future write (the staff-
--    edit form is wired) would 42703. Adding the columns activates
--    the latent UI without a code change.
--
-- All idempotent.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS intake_notes TEXT,
  ADD COLUMN IF NOT EXISTS workshop_notes TEXT;

-- Listings should hide soft-deleted suppliers by default — partial
-- index helps the common WHERE deleted_at IS NULL filter.
CREATE INDEX IF NOT EXISTS idx_suppliers_active
  ON public.suppliers (tenant_id)
  WHERE deleted_at IS NULL;
