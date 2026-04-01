-- Enable RLS on login_attempts table
-- Table contains emails and IP addresses - should not be exposed via API

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS login_attempts_service_only ON login_attempts;

-- Policy: Deny all authenticated access (table only written by service role)
CREATE POLICY login_attempts_service_only ON login_attempts
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE login_attempts IS 'Login attempt tracking. Service role only - no user access.';
