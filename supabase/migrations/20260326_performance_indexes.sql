-- Performance indexes for tenant-scoped queries
-- Created: 2026-03-26

-- Tenant-scoped queries (most tables)
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_created ON inventory(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created ON customers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_tenant_created ON repairs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_tenant_stage ON repairs(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_created ON quotes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON tasks(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON sales(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_tenant_created ON bespoke_jobs(tenant_id, created_at DESC);

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Additional useful indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_invoice_date ON invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due_date ON invoices(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_repairs_tenant_due_date ON repairs(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_tenant_stage ON bespoke_jobs(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON expenses(tenant_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_date ON purchase_orders(tenant_id, order_date DESC);
