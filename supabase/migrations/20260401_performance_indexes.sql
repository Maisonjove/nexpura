-- Performance indexes for Nexpura optimization pass
-- Created: 2026-04-01

-- ────────────────────────────────────────────────────────────────
-- Dashboard Performance
-- ────────────────────────────────────────────────────────────────

-- Sales aggregation by tenant and month
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created_total 
  ON sales(tenant_id, created_at DESC) 
  INCLUDE (total);

-- Outstanding invoice totals (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_invoices_outstanding_amounts 
  ON invoices(tenant_id, status) 
  INCLUDE (amount_due, due_date) 
  WHERE status IN ('unpaid', 'partial', 'overdue') AND deleted_at IS NULL;

-- Tasks due today (hot query)
CREATE INDEX IF NOT EXISTS idx_tasks_due_today 
  ON tasks(tenant_id, due_date, status) 
  WHERE status != 'completed';

-- Tasks by assignee (for team summary)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee 
  ON tasks(tenant_id, assigned_to, status, due_date) 
  WHERE status != 'completed';

-- ────────────────────────────────────────────────────────────────
-- List Page Performance
-- ────────────────────────────────────────────────────────────────

-- Repairs list with search
CREATE INDEX IF NOT EXISTS idx_repairs_search 
  ON repairs(tenant_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Bespoke jobs list with search
CREATE INDEX IF NOT EXISTS idx_bespoke_search 
  ON bespoke_jobs(tenant_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Invoice list with status filter
CREATE INDEX IF NOT EXISTS idx_invoices_list 
  ON invoices(tenant_id, created_at DESC, status) 
  WHERE deleted_at IS NULL;

-- Customers list with tenant
CREATE INDEX IF NOT EXISTS idx_customers_list 
  ON customers(tenant_id, full_name);

-- Inventory list with status
CREATE INDEX IF NOT EXISTS idx_inventory_list 
  ON inventory(tenant_id, created_at DESC, status) 
  WHERE deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────────
-- POS Performance
-- ────────────────────────────────────────────────────────────────

-- POS inventory lookup (active items with quantity)
CREATE INDEX IF NOT EXISTS idx_inventory_pos_active 
  ON inventory(tenant_id, status, quantity) 
  INCLUDE (id, name, sku, retail_price, primary_image) 
  WHERE status = 'active' AND deleted_at IS NULL AND quantity > 0;

-- Customer lookup for POS
CREATE INDEX IF NOT EXISTS idx_customers_pos 
  ON customers(tenant_id) 
  INCLUDE (id, full_name, email, store_credit);

-- ────────────────────────────────────────────────────────────────
-- Detail Page Performance
-- ────────────────────────────────────────────────────────────────

-- Job attachments lookup
CREATE INDEX IF NOT EXISTS idx_job_attachments_lookup 
  ON job_attachments(job_type, job_id);

-- Job events lookup
CREATE INDEX IF NOT EXISTS idx_job_events_lookup 
  ON job_events(job_type, job_id, created_at DESC);

-- Repair stages history
CREATE INDEX IF NOT EXISTS idx_repair_stages_repair 
  ON repair_stages(repair_id, created_at DESC);

-- Bespoke job stages history
CREATE INDEX IF NOT EXISTS idx_bespoke_stages_job 
  ON bespoke_job_stages(job_id, created_at DESC);

-- Invoice line items lookup
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice 
  ON invoice_line_items(invoice_id);

-- Payments by invoice
CREATE INDEX IF NOT EXISTS idx_payments_invoice 
  ON payments(invoice_id, created_at);

-- ────────────────────────────────────────────────────────────────
-- Workshop / Tasks Performance
-- ────────────────────────────────────────────────────────────────

-- Workshop repairs (not completed)
CREATE INDEX IF NOT EXISTS idx_repairs_workshop 
  ON repairs(tenant_id, stage, due_date) 
  WHERE deleted_at IS NULL AND stage NOT IN ('collected', 'cancelled');

-- Workshop bespoke jobs
CREATE INDEX IF NOT EXISTS idx_bespoke_workshop 
  ON bespoke_jobs(tenant_id, stage, due_date) 
  WHERE deleted_at IS NULL AND stage NOT IN ('completed', 'cancelled');

-- ────────────────────────────────────────────────────────────────
-- Search Performance
-- ────────────────────────────────────────────────────────────────

-- Inventory barcode/SKU quick lookup
CREATE INDEX IF NOT EXISTS idx_inventory_barcode 
  ON inventory(tenant_id, barcode_value) 
  WHERE barcode_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_sku_lookup 
  ON inventory(tenant_id, sku) 
  WHERE sku IS NOT NULL;

-- Customer search by email
CREATE INDEX IF NOT EXISTS idx_customers_email_search 
  ON customers(tenant_id, email) 
  WHERE email IS NOT NULL;

-- Customer search by mobile
CREATE INDEX IF NOT EXISTS idx_customers_mobile_search 
  ON customers(tenant_id, mobile) 
  WHERE mobile IS NOT NULL;

-- Repair number lookup
CREATE INDEX IF NOT EXISTS idx_repairs_number_lookup 
  ON repairs(tenant_id, repair_number);

-- Invoice number lookup
CREATE INDEX IF NOT EXISTS idx_invoices_number_lookup 
  ON invoices(tenant_id, invoice_number);

-- ────────────────────────────────────────────────────────────────
-- Auth / Permission Performance
-- ────────────────────────────────────────────────────────────────

-- Role permissions lookup (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup 
  ON role_permissions(tenant_id, role);

-- Users by tenant (for team management)
CREATE INDEX IF NOT EXISTS idx_users_tenant_role 
  ON users(tenant_id, role);

-- ────────────────────────────────────────────────────────────────
-- Billing / Subscription Performance
-- ────────────────────────────────────────────────────────────────

-- Subscription status check (middleware hot path)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
  ON subscriptions(tenant_id, status);

-- ────────────────────────────────────────────────────────────────
-- Marketing / Communications Performance
-- ────────────────────────────────────────────────────────────────

-- Communications by customer
CREATE INDEX IF NOT EXISTS idx_communications_customer 
  ON communications(customer_id, created_at DESC);

-- Activity log by tenant
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant 
  ON activity_log(tenant_id, created_at DESC);
