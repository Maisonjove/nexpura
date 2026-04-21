-- =====================================================
-- INVOICES.sale_id COLUMN — 2026-04-21
-- =====================================================
--
-- POS createPOSSale + createLaybySale both try to write a `sale_id`
-- foreign key onto the auto-generated invoice row so the invoice
-- detail page can link back to the sale record. During the 2026-04-21
-- sandbox verification this column wasn't in the live schema
-- ("Could not find the 'sale_id' column of 'invoices' in the schema
-- cache"), so every POS checkout produced a sale but silently dropped
-- the invoice in the catch-all try block. Cash POS therefore recorded
-- a paid sale with no matching invoice — customer-facing receipts,
-- Finance reports, and the invoice-list page all missed it.
--
-- Applying this migration + the companion API patch
-- (src/app/(app)/pos/actions.ts — retry without sale_id on missing
-- column) means:
--   - pre-migration: POS still creates the invoice, just without the
--     sale_id linkage (correctness preserved, link deferred).
--   - post-migration: sale_id populates on every new POS invoice,
--     old invoice rows stay NULL until someone backfills them
--     (optional, not required).
-- =====================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_sale_id_idx ON public.invoices (sale_id) WHERE sale_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.sale_id IS
  'Optional back-reference to the POS sale this invoice was generated from. Set by createPOSSale() when the POS checkout is completed; nullable because non-POS invoices (manual, repair-driven, bespoke-driven) may not have a matching sale row.';
