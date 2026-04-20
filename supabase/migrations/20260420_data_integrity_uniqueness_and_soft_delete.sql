-- =====================================================
-- DATA INTEGRITY GUARDS — 2026-04-20
-- =====================================================
--
-- Closes three classes of bug found in destructive production QA:
--
--   1. Duplicate internal identifiers allowed at DB level on several tables.
--      UI actions have soft checks but direct-REST / integration writes
--      could create duplicates silently. Accounting + barcode + workflow
--      integrity consequences.
--
--   2. (Bug #8 from the QA report turned out to be a false alarm:
--       sync_invoice_payment_totals trigger is already installed and
--       working correctly — re-verified by inserting a payment via
--       Management API and confirming amount_paid / amount_due / status
--       updated. No migration needed for payments sync.)
--
--   3. Soft-deleted customer rows still had "live" references on the
--      repair detail page + leaked their names through /customers/[id]
--      generateMetadata. Fixed in TypeScript — no SQL change needed.
--
-- What this migration ships:
--
--   A. invoices + inventory — partial UNIQUE indexes.
--      These tables had ONLY QA-test duplicates on one tenant; cleaned
--      (3 rows) before applying the index. Safe to commit now.
--
--   B. repairs + bespoke_jobs — trigger-based uniqueness guard.
--      These tables have legacy duplicate rows on ~15 other tenants
--      (all created 2026-03-25, almost certainly from a seed/import
--      script that ran twice). A partial UNIQUE index would fail to
--      apply against existing data; a BEFORE INSERT/UPDATE trigger
--      only rejects NEW collisions, leaving legacy dupes untouched
--      until tenants clean them up individually.
--
-- Note for future maintenance: if/when the legacy repair + bespoke dupes
-- are resolved, the trigger-based guards here can be replaced by partial
-- UNIQUE indexes (same shape as invoices + inventory below) for a tiny
-- perf + simplicity gain.
-- =====================================================

-- =====================================================
-- A1. invoices.invoice_number — partial UNIQUE
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_id_invoice_number_unique
  ON invoices (tenant_id, invoice_number)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX invoices_tenant_id_invoice_number_unique IS
  'Prevents duplicate invoice numbers within a tenant. ATO/tax-compliance critical: two invoices with the same number are unacceptable in a tax-invoice sequence. Partial index excludes soft-deleted rows so a number can be reused after a row is hard-retired via deleted_at.';

-- =====================================================
-- A2. inventory.sku — partial UNIQUE
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS inventory_tenant_id_sku_unique
  ON inventory (tenant_id, sku)
  WHERE deleted_at IS NULL AND sku IS NOT NULL;

COMMENT ON INDEX inventory_tenant_id_sku_unique IS
  'Prevents duplicate SKUs within a tenant. Barcode + POS lookup integrity: a scanned SKU must resolve to exactly one inventory row. Partial index excludes soft-deleted rows and rows without a SKU (SKU is optional).';

-- =====================================================
-- B1. repairs.repair_number — trigger-based uniqueness
-- =====================================================
CREATE OR REPLACE FUNCTION reject_duplicate_repair_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.repair_number IS NULL THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM repairs
    WHERE tenant_id = NEW.tenant_id
      AND repair_number = NEW.repair_number
      AND deleted_at IS NULL
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'duplicate repair_number % within tenant %', NEW.repair_number, NEW.tenant_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS repairs_reject_duplicate_repair_number ON repairs;

CREATE TRIGGER repairs_reject_duplicate_repair_number
  BEFORE INSERT OR UPDATE OF repair_number, tenant_id, deleted_at ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION reject_duplicate_repair_number();

COMMENT ON FUNCTION reject_duplicate_repair_number() IS
  'Trigger-based uniqueness guard on (tenant_id, repair_number) for active rows. Chosen over a partial UNIQUE index because several tenants have pre-existing duplicate repair_number rows from a 2026-03-25 seed/import, and those rows cannot be safely bulk-cleaned from this migration. The trigger rejects only NEW collisions; legacy dupes are tolerated until tenants resolve them manually.';

-- =====================================================
-- B2. bespoke_jobs.job_number — trigger-based uniqueness
-- =====================================================
CREATE OR REPLACE FUNCTION reject_duplicate_bespoke_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM bespoke_jobs
    WHERE tenant_id = NEW.tenant_id
      AND job_number = NEW.job_number
      AND deleted_at IS NULL
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'duplicate job_number % within tenant %', NEW.job_number, NEW.tenant_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bespoke_jobs_reject_duplicate_job_number ON bespoke_jobs;

CREATE TRIGGER bespoke_jobs_reject_duplicate_job_number
  BEFORE INSERT OR UPDATE OF job_number, tenant_id, deleted_at ON bespoke_jobs
  FOR EACH ROW
  EXECUTE FUNCTION reject_duplicate_bespoke_job_number();

COMMENT ON FUNCTION reject_duplicate_bespoke_job_number() IS
  'Trigger-based uniqueness guard on (tenant_id, job_number) for active rows. Same rationale as repairs: legacy duplicates from 2026-03-25 on several tenants prevent a partial UNIQUE index, but new collisions should still be rejected.';
