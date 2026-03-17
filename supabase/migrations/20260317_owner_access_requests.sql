-- Owner Access Requests table
-- Allows platform owner to request temporary access to tenant dashboards

CREATE TABLE IF NOT EXISTS owner_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_owner_access_requests_tenant_id ON owner_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_owner_access_requests_status ON owner_access_requests(status);

-- RLS policies
ALTER TABLE owner_access_requests ENABLE ROW LEVEL SECURITY;

-- Tenants can see requests for their own tenant
CREATE POLICY "Tenants can view their own access requests"
  ON owner_access_requests
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Tenants can update (approve/deny/revoke) their own access requests
CREATE POLICY "Tenants can update their own access requests"
  ON owner_access_requests
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_owner_access_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_owner_access_requests_updated_at
  BEFORE UPDATE ON owner_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_owner_access_requests_updated_at();
