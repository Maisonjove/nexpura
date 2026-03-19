-- Fix missing columns identified during production verification
-- Date: 2026-03-19

-- 1. Add store_credit_amount to sales table (for POS)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_credit_amount numeric DEFAULT 0;

-- 2. Add is_consignment to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_consignment boolean DEFAULT false;

-- 3. Add business_mode to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_mode text DEFAULT 'retail';

-- 4. Add verified_custom_domain to tenants for website builder preview
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS verified_custom_domain text;

-- Update schema cache by touching the tables
COMMENT ON TABLE sales IS 'Sales transactions including POS sales';
COMMENT ON TABLE inventory IS 'Inventory items including consignment tracking';
COMMENT ON TABLE tenants IS 'Tenant/store configuration';
