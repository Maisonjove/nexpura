-- Performance indexes for location-scoped queries
-- Created: 2026-03-27

-- Location indexes for multi-location tenants
CREATE INDEX IF NOT EXISTS idx_locations_tenant_active ON locations(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_location ON sales(location_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_location ON sales(tenant_id, location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_location ON repairs(location_id);
CREATE INDEX IF NOT EXISTS idx_repairs_tenant_location ON repairs(tenant_id, location_id, stage);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_location ON inventory(tenant_id, location_id, quantity);
CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_location ON bespoke_jobs(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_location ON invoices(location_id);

-- Dashboard query optimization
CREATE INDEX IF NOT EXISTS idx_sales_tenant_month ON sales(tenant_id, created_at) WHERE created_at >= CURRENT_DATE - INTERVAL '31 days';
CREATE INDEX IF NOT EXISTS idx_repairs_active ON repairs(tenant_id, stage) WHERE stage NOT IN ('collected', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_invoices_outstanding ON invoices(tenant_id, status, due_date) WHERE status IN ('unpaid', 'partial', 'overdue') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(tenant_id, quantity, low_stock_threshold) WHERE track_quantity = true;

-- Partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_repairs_overdue ON repairs(tenant_id, due_date) 
  WHERE stage NOT IN ('collected', 'cancelled') AND due_date < CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_active ON bespoke_jobs(tenant_id, stage) 
  WHERE stage NOT IN ('completed', 'cancelled') AND deleted_at IS NULL;
