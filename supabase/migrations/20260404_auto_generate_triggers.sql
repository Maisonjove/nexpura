-- ============================================================
-- Auto-generate repair_number and passport_uid on INSERT
-- This allows direct API inserts without manually providing IDs
-- ============================================================

-- 1. REPAIR NUMBER AUTO-GENERATION
-- ================================

-- Function to auto-generate repair_number if not provided
CREATE OR REPLACE FUNCTION generate_repair_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_rec RECORD;
  new_seq INTEGER;
BEGIN
  -- Only generate if repair_number is NULL or empty
  IF NEW.repair_number IS NULL OR NEW.repair_number = '' THEN
    -- Get tenant prefix and sequence
    SELECT repair_prefix, repair_sequence INTO tenant_rec
    FROM tenants WHERE id = NEW.tenant_id;
    
    IF tenant_rec IS NOT NULL THEN
      -- Increment sequence
      new_seq := COALESCE(tenant_rec.repair_sequence, 0) + 1;
      
      -- Update tenant sequence
      UPDATE tenants SET repair_sequence = new_seq WHERE id = NEW.tenant_id;
      
      -- Set repair_number with prefix and zero-padded number
      NEW.repair_number := COALESCE(tenant_rec.repair_prefix, 'REP-') || LPAD(new_seq::TEXT, 3, '0');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_generate_repair_number ON repairs;

-- Create trigger
CREATE TRIGGER trigger_generate_repair_number
  BEFORE INSERT ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION generate_repair_number();


-- 2. PASSPORT UID AUTO-GENERATION  
-- ================================

-- First, add passport_sequence to tenants if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'passport_sequence'
  ) THEN
    ALTER TABLE tenants ADD COLUMN passport_sequence INTEGER DEFAULT 0;
  END IF;
END $$;

-- Function to auto-generate passport_uid if not provided
-- Uses format: 100000001, 100000002, etc. (numeric, globally unique)
CREATE OR REPLACE FUNCTION generate_passport_uid()
RETURNS TRIGGER AS $$
DECLARE
  tenant_rec RECORD;
  new_seq INTEGER;
  global_seq BIGINT;
BEGIN
  -- Only generate if passport_uid is NULL or empty
  IF NEW.passport_uid IS NULL OR NEW.passport_uid = '' THEN
    -- Get current sequence
    SELECT passport_sequence INTO tenant_rec
    FROM tenants WHERE id = NEW.tenant_id;
    
    IF tenant_rec IS NOT NULL THEN
      -- Increment sequence
      new_seq := COALESCE(tenant_rec.passport_sequence, 0) + 1;
      
      -- Update tenant sequence
      UPDATE tenants SET passport_sequence = new_seq WHERE id = NEW.tenant_id;
      
      -- Generate UID: 100000000 base + sequence (keeps your existing numeric format)
      global_seq := 100000000 + new_seq;
      NEW.passport_uid := global_seq::TEXT;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_generate_passport_uid ON passports;

-- Create trigger
CREATE TRIGGER trigger_generate_passport_uid
  BEFORE INSERT ON passports
  FOR EACH ROW
  EXECUTE FUNCTION generate_passport_uid();


-- 3. BESPOKE JOB NUMBER AUTO-GENERATION
-- =====================================

-- Function to auto-generate job_number if not provided
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_rec RECORD;
  new_seq INTEGER;
BEGIN
  -- Only generate if job_number is NULL or empty
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    -- Get tenant prefix and sequence
    SELECT job_prefix, job_sequence INTO tenant_rec
    FROM tenants WHERE id = NEW.tenant_id;
    
    IF tenant_rec IS NOT NULL THEN
      -- Increment sequence
      new_seq := COALESCE(tenant_rec.job_sequence, 0) + 1;
      
      -- Update tenant sequence
      UPDATE tenants SET job_sequence = new_seq WHERE id = NEW.tenant_id;
      
      -- Set job_number with prefix
      NEW.job_number := COALESCE(tenant_rec.job_prefix, 'JOB-') || LPAD(new_seq::TEXT, 3, '0');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_generate_job_number ON bespoke_jobs;

-- Create trigger
CREATE TRIGGER trigger_generate_job_number
  BEFORE INSERT ON bespoke_jobs
  FOR EACH ROW
  EXECUTE FUNCTION generate_job_number();


-- 4. INVOICE NUMBER AUTO-GENERATION
-- =================================

-- Function to auto-generate invoice_number if not provided
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_rec RECORD;
  new_seq INTEGER;
BEGIN
  -- Only generate if invoice_number is NULL or empty
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    -- Get tenant prefix and sequence
    SELECT invoice_prefix, invoice_sequence INTO tenant_rec
    FROM tenants WHERE id = NEW.tenant_id;
    
    IF tenant_rec IS NOT NULL THEN
      -- Increment sequence
      new_seq := COALESCE(tenant_rec.invoice_sequence, 0) + 1;
      
      -- Update tenant sequence
      UPDATE tenants SET invoice_sequence = new_seq WHERE id = NEW.tenant_id;
      
      -- Set invoice_number with prefix
      NEW.invoice_number := COALESCE(tenant_rec.invoice_prefix, 'INV-') || LPAD(new_seq::TEXT, 3, '0');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices;

-- Create trigger
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();


-- 5. QUOTE NUMBER AUTO-GENERATION
-- ===============================

-- Function to auto-generate quote_number if not provided
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_rec RECORD;
  new_seq INTEGER;
BEGIN
  -- Only generate if quote_number is NULL or empty
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    -- Get tenant prefix and sequence
    SELECT quote_prefix, quote_sequence INTO tenant_rec
    FROM tenants WHERE id = NEW.tenant_id;
    
    IF tenant_rec IS NOT NULL THEN
      -- Increment sequence
      new_seq := COALESCE(tenant_rec.quote_sequence, 0) + 1;
      
      -- Update tenant sequence
      UPDATE tenants SET quote_sequence = new_seq WHERE id = NEW.tenant_id;
      
      -- Set quote_number with prefix
      NEW.quote_number := COALESCE(tenant_rec.quote_prefix, 'QUO-') || LPAD(new_seq::TEXT, 3, '0');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_generate_quote_number ON quotes;

-- Create trigger
CREATE TRIGGER trigger_generate_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION generate_quote_number();


-- ============================================================
-- Summary of triggers created:
-- 1. repairs.repair_number → auto-generates from tenant prefix + sequence
-- 2. passports.passport_uid → auto-generates numeric UID (100000001, etc.)
-- 3. bespoke_jobs.job_number → auto-generates from tenant prefix + sequence
-- 4. invoices.invoice_number → auto-generates from tenant prefix + sequence
-- 5. quotes.quote_number → auto-generates from tenant prefix + sequence
-- ============================================================
