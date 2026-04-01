-- Search Performance Indexes
-- Created: 2026-04-01
-- Focus: pg_trgm for fuzzy search, covering indexes for common lookups

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ────────────────────────────────────────────────────────────────
-- Customer Search (most common search operation)
-- ────────────────────────────────────────────────────────────────

-- GIN index for trigram search on customer name
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm 
  ON customers USING GIN (full_name gin_trgm_ops);

-- GIN index for trigram search on customer email
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm 
  ON customers USING GIN (email gin_trgm_ops);

-- Combined tenant + name for filtered searches
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name 
  ON customers(tenant_id, full_name);

-- ────────────────────────────────────────────────────────────────
-- Inventory Search (POS and inventory pages)
-- ────────────────────────────────────────────────────────────────

-- GIN index for trigram search on inventory name
CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm 
  ON inventory USING GIN (name gin_trgm_ops);

-- GIN index for trigram search on SKU
CREATE INDEX IF NOT EXISTS idx_inventory_sku_trgm 
  ON inventory USING GIN (sku gin_trgm_ops);

-- Combined tenant + name for filtered active inventory
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_name_active 
  ON inventory(tenant_id, name) 
  WHERE status = 'active' AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────────
-- Repair Search
-- ────────────────────────────────────────────────────────────────

-- GIN index for trigram search on repair description
CREATE INDEX IF NOT EXISTS idx_repairs_description_trgm 
  ON repairs USING GIN (item_description gin_trgm_ops);

-- Combined tenant + repair_number for exact lookups
CREATE INDEX IF NOT EXISTS idx_repairs_tenant_number 
  ON repairs(tenant_id, repair_number);

-- ────────────────────────────────────────────────────────────────
-- Bespoke Job Search
-- ────────────────────────────────────────────────────────────────

-- GIN index for trigram search on job title
CREATE INDEX IF NOT EXISTS idx_bespoke_title_trgm 
  ON bespoke_jobs USING GIN (title gin_trgm_ops);

-- Combined tenant + job_number for exact lookups
CREATE INDEX IF NOT EXISTS idx_bespoke_tenant_number 
  ON bespoke_jobs(tenant_id, job_number);

-- ────────────────────────────────────────────────────────────────
-- Invoice Search
-- ────────────────────────────────────────────────────────────────

-- Combined tenant + invoice_number for exact lookups
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_number 
  ON invoices(tenant_id, invoice_number);

-- ────────────────────────────────────────────────────────────────
-- Customer Detail Page - Related Records
-- ────────────────────────────────────────────────────────────────

-- Fast customer_id lookups for related tables
CREATE INDEX IF NOT EXISTS idx_repairs_customer_tenant 
  ON repairs(customer_id, tenant_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bespoke_customer_tenant 
  ON bespoke_jobs(customer_id, tenant_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_customer_tenant 
  ON invoices(customer_id, tenant_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_customer_tenant 
  ON quotes(customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_sales_customer_tenant 
  ON sales(customer_id, tenant_id);

-- customer_communications is a view, index on base table communications instead
CREATE INDEX IF NOT EXISTS idx_comms_customer_tenant 
  ON communications(customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_wishlists_customer_tenant 
  ON wishlists(customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_customer_tenant 
  ON loyalty_transactions(customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_history_customer 
  ON customer_store_credit_history(customer_id);

-- ────────────────────────────────────────────────────────────────
-- Bespoke Detail Page
-- ────────────────────────────────────────────────────────────────

-- Milestones by job
CREATE INDEX IF NOT EXISTS idx_bespoke_milestones_job 
  ON bespoke_milestones(bespoke_job_id);
