-- PR-13 cleanup (Joey 2026-05-04). Phase 2 audit identified a silent
-- data-corruption pattern in the Shopify order importer
-- (`importOrdersFromShopify` in src/lib/integrations/shopify/sync.ts):
--
--   for each order:
--     - look up sales row by external_reference; if exists, skip
--     - else insert sales row, then loop line_items inserting each
--     - if a line_item insert fails: parent sale row already exists,
--       but with an incomplete set of sale_items
--   on next sync run:
--     - the existing-check finds the sale and SKIPS, so the orphan
--       never self-heals; the customer's Shopify order shows complete
--       while Nexpura shows an incomplete sale forever.
--
-- PR-B3 wrapped the failure with logger.error so it surfaces in
-- Sentry; this migration + the matching sync.ts changes implement the
-- architectural fix:
--
--   `import_status` is a 3-state machine on sales:
--     - NULL                 -> imported clean OR not imported via the
--                              partial-import codepath at all (e.g. a
--                              POS sale). Treat NULL as 'complete'.
--     - 'incomplete'         -> at least one line_item insert failed;
--                              parent sale exists but is missing rows.
--                              Reconciliation cron (every 6h) picks
--                              these up, re-fetches the upstream order,
--                              and inserts the missing line_items.
--     - 'reconciled'         -> reconciliation cron successfully filled
--                              the gaps. Kept distinct from NULL so we
--                              can audit how often partial imports
--                              actually happen in prod.
--
-- We also add `external_reference` (TEXT NULL) which the importer
-- already references but which never existed on the sales schema
-- (verified: information_schema query 2026-05-04 returned 0 rows for
-- both `external_reference` and `import_metadata`). Without this
-- column, the existing-check `.eq("external_reference", ...)` errors
-- out at the PostgREST layer -- meaning the partial-import bug doesn't
-- even trigger today because no Shopify orders import successfully.
-- Adding the column is required for the self-healing logic to work
-- (and for Shopify imports to function at all).
--
-- Existing rows keep import_status = NULL (default), which the new
-- code treats as 'complete' -- no backfill needed.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS import_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS external_reference TEXT NULL;

-- Constrain the import_status state machine to the documented values.
-- NULL is allowed (= 'complete'). Wrap in DO block so re-running this
-- migration on a DB that already has the constraint is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_import_status_check'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_import_status_check
      CHECK (import_status IS NULL OR import_status IN ('complete', 'incomplete', 'reconciled'));
  END IF;
END $$;

-- Hot index for the reconciliation cron: it scans for incomplete
-- shopify imports every 6 hours. Partial index keeps it tiny -- only
-- rows that need attention are indexed.
CREATE INDEX IF NOT EXISTS sales_import_status_incomplete_idx
  ON sales (tenant_id, external_reference)
  WHERE import_status = 'incomplete';

-- General lookup index for the importer's existing-check + idempotent
-- replay scenarios. Per-tenant uniqueness is enforced by the importer's
-- application-layer check (existing-check before insert) -- we don't
-- promote it to a UNIQUE constraint here because legacy rows may have
-- NULL external_reference and that would still fit a unique-with-NULLs
-- index, but a future sale-merge or admin-import flow could re-use the
-- column with looser semantics.
CREATE INDEX IF NOT EXISTS sales_external_reference_idx
  ON sales (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;

COMMENT ON COLUMN sales.import_status IS
  'Partial-import state machine for cross-system imports (Shopify orders, etc). NULL=complete, ''incomplete''=line_items missing, ''reconciled''=cron filled the gaps. See PR-13 + src/app/api/cron/shopify-reconciliation/route.ts.';

COMMENT ON COLUMN sales.external_reference IS
  'Upstream system reference for imported sales (e.g. ''shopify_<order_id>''). Used by importers for idempotent replay + by the reconciliation cron to re-fetch source orders.';
