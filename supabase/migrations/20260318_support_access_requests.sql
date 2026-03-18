-- Support Access Requests table
-- Allows super admins to request temporary access to tenant dashboards

CREATE TABLE IF NOT EXISTS support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES auth.users(id) NOT NULL,
  requested_by_email text NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
  token text UNIQUE NOT NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_access_tenant ON support_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_access_token ON support_access_requests(token);
CREATE INDEX IF NOT EXISTS idx_support_access_status ON support_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_access_requested_by ON support_access_requests(requested_by);

-- RLS Policies
ALTER TABLE support_access_requests ENABLE ROW LEVEL SECURITY;

-- Allow super admins to see all requests
CREATE POLICY "Super admins can view all support access requests"
  ON support_access_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Allow tenant owners to see their tenant's requests
CREATE POLICY "Tenant owners can view their support access requests"
  ON support_access_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = support_access_requests.tenant_id
      AND users.role = 'owner'
    )
  );

-- Allow super admins to create requests
CREATE POLICY "Super admins can create support access requests"
  ON support_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Allow updates only via service role (admin client)
-- This ensures approval/denial goes through our server actions

COMMENT ON TABLE support_access_requests IS 'Tracks support team temporary access requests to tenant dashboards';
