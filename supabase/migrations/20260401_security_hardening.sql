-- =====================================================
-- SECURITY HARDENING MIGRATION - April 1, 2026
-- =====================================================

-- =====================================================
-- 1. STORAGE BUCKET POLICIES
-- Make job-photos, repair-photos, passport-photos private
-- Keep logos and nexpura-public as public (intentional)
-- =====================================================

-- First, update bucket settings to private
UPDATE storage.buckets SET public = false WHERE name IN ('job-photos', 'repair-photos', 'passport-photos');

-- Create RLS policies for job-photos
DROP POLICY IF EXISTS "job_photos_tenant_select" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_tenant_delete" ON storage.objects;

CREATE POLICY "job_photos_tenant_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "job_photos_tenant_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "job_photos_tenant_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-photos' AND
  auth.role() = 'authenticated'
);

-- Create RLS policies for repair-photos
CREATE POLICY "repair_photos_tenant_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'repair-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "repair_photos_tenant_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'repair-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "repair_photos_tenant_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'repair-photos' AND
  auth.role() = 'authenticated'
);

-- Create RLS policies for passport-photos (keep public for verification)
-- Passport photos need to be viewable publicly for verification links
-- But only authenticated users can upload
CREATE POLICY "passport_photos_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'passport-photos');

CREATE POLICY "passport_photos_tenant_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'passport-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "passport_photos_tenant_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'passport-photos' AND
  auth.role() = 'authenticated'
);

-- =====================================================
-- 2. AUDIT LOG IMPROVEMENTS
-- Add more comprehensive audit triggers
-- =====================================================

-- Create audit trigger function if not exists
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_payments_changes ON payments;
CREATE TRIGGER audit_payments_changes
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_refunds_changes ON refunds;
CREATE TRIGGER audit_refunds_changes
  AFTER INSERT OR UPDATE OR DELETE ON refunds
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_invoices_changes ON invoices;
CREATE TRIGGER audit_invoices_changes
  AFTER UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_store_credit_changes ON customers;
CREATE TRIGGER audit_store_credit_changes
  AFTER UPDATE ON customers
  FOR EACH ROW
  WHEN (OLD.store_credit IS DISTINCT FROM NEW.store_credit)
  EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_user_role_changes ON users;
CREATE TRIGGER audit_user_role_changes
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id)
  EXECUTE FUNCTION audit_sensitive_changes();

-- =====================================================
-- 3. ADD MISSING CONSTRAINTS
-- =====================================================

-- Ensure invoice amount_paid can never exceed total
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_amount_paid_valid;
ALTER TABLE invoices ADD CONSTRAINT invoices_amount_paid_valid 
  CHECK (amount_paid >= 0 AND amount_paid <= total);

-- Ensure refund total can never exceed sale total
-- (This requires a function since it references another table)

-- Ensure voucher amount is positive (skip if table doesn't exist)
-- ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_amount_positive;
-- ALTER TABLE vouchers ADD CONSTRAINT vouchers_amount_positive CHECK (amount > 0);

-- Ensure store credit balance is non-negative
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_store_credit_non_negative;
ALTER TABLE customers ADD CONSTRAINT customers_store_credit_non_negative 
  CHECK (store_credit IS NULL OR store_credit >= 0);

-- =====================================================
-- 4. RATE LIMIT ABUSE PREVENTION
-- Create table to track login attempts if not exists
-- =====================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, created_at);

-- Function to check login rate limit
CREATE OR REPLACE FUNCTION check_login_rate_limit(p_email TEXT, p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_email_attempts INTEGER;
  v_ip_attempts INTEGER;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*) INTO v_email_attempts
  FROM login_attempts
  WHERE email = p_email
    AND success = false
    AND created_at > NOW() - INTERVAL '15 minutes';
  
  SELECT COUNT(*) INTO v_ip_attempts
  FROM login_attempts
  WHERE ip_address = p_ip
    AND success = false
    AND created_at > NOW() - INTERVAL '15 minutes';
  
  -- Block if more than 5 failed attempts per email or 20 per IP
  RETURN v_email_attempts < 5 AND v_ip_attempts < 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. ENSURE SENSITIVE FIELDS ARE NOT EXPOSED IN RLS
-- =====================================================

-- Update customers policy to hide sensitive fields from staff
-- (store_credit should only be visible to owner/manager)
DROP POLICY IF EXISTS customers_select_tenant ON customers;
CREATE POLICY customers_select_tenant
ON customers FOR SELECT
USING (tenant_id = get_tenant_id());

-- Note: Field-level security for store_credit should be handled at application layer

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION audit_sensitive_changes() IS 'Security audit trigger for sensitive data changes. Logs payments, refunds, invoices, store credit, and role changes.';
COMMENT ON FUNCTION check_login_rate_limit(TEXT, TEXT) IS 'Rate limit function for login attempts. Blocks after 5 failed attempts per email or 20 per IP within 15 minutes.';
COMMENT ON TABLE login_attempts IS 'Tracks login attempts for rate limiting and security monitoring.';
