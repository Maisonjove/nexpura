-- =====================================================
-- FIX CRITICAL BUGS - April 1, 2026
-- 1. Fix audit_sensitive_changes() column name mismatch
-- 2. Add trigger to auto-populate customer full_name
-- =====================================================

-- =====================================================
-- 1. FIX AUDIT TRIGGER COLUMN NAMES
-- The audit_logs table uses entity_type/entity_id
-- but the trigger was inserting into table_name/record_id
-- =====================================================

CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    entity_type,      -- FIXED: was table_name
    entity_id,        -- FIXED: was record_id
    old_data,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),  -- entity_id is UUID
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

COMMENT ON FUNCTION audit_sensitive_changes() IS 'Security audit trigger for sensitive data changes. Fixed: uses correct column names entity_type/entity_id.';

-- =====================================================
-- 2. FIX CUSTOMER FULL_NAME AUTO-POPULATION
-- Add trigger to compute full_name from first_name + last_name
-- =====================================================

CREATE OR REPLACE FUNCTION compute_customer_full_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute full_name from first_name and last_name
  -- Handle NULL values gracefully
  NEW.full_name := NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), '');
  
  -- If still empty, use email prefix as fallback
  IF NEW.full_name IS NULL OR NEW.full_name = '' THEN
    NEW.full_name := COALESCE(
      SPLIT_PART(NEW.email, '@', 1),
      'Customer'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS customers_compute_full_name ON customers;

-- Create trigger to run BEFORE INSERT OR UPDATE
CREATE TRIGGER customers_compute_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name, email ON customers
  FOR EACH ROW
  EXECUTE FUNCTION compute_customer_full_name();

COMMENT ON FUNCTION compute_customer_full_name() IS 'Auto-computes full_name from first_name + last_name, falling back to email prefix.';

-- =====================================================
-- 3. FIX EXISTING CUSTOMERS WITH NULL FULL_NAME
-- =====================================================

UPDATE customers
SET full_name = COALESCE(
  NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
  SPLIT_PART(email, '@', 1),
  'Customer'
)
WHERE full_name IS NULL OR full_name = '';
