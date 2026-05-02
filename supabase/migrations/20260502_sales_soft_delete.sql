-- QA Group 3 — soft-delete on sales + sale_items so deleting a sale is
-- undoable and the row stays around for audit + undo. Also lets the
-- delete handler stamp deleted_at + restore inventory before flipping
-- the column rather than blowing away the row entirely.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Existing list/detail queries don't filter deleted_at yet; that's the
-- next commit's job. The column defaults to NULL so all current rows
-- remain visible.

CREATE INDEX IF NOT EXISTS idx_sales_tenant_active
  ON sales (tenant_id) WHERE deleted_at IS NULL;
