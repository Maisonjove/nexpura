-- Add admin_notes column to tenants for super admin use
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_notes text;

-- Add deleted_at soft-delete column if not present
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at) WHERE deleted_at IS NULL;
