-- Edge Case Protections
-- 1. Idempotency keys for duplicate submission prevention
-- 2. Slow network handling
-- 3. Browser back button protection

-- Add idempotency_key to critical tables
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create indexes for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_sales_idempotency_key 
  ON sales(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_idempotency_key 
  ON invoices(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key 
  ON payments(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Add unique constraint per tenant to prevent duplicates
ALTER TABLE sales 
  ADD CONSTRAINT sales_idempotency_unique 
  UNIQUE (tenant_id, idempotency_key);

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_idempotency_unique 
  UNIQUE (tenant_id, idempotency_key);

ALTER TABLE payments 
  ADD CONSTRAINT payments_idempotency_unique 
  UNIQUE (tenant_id, idempotency_key);

-- Add processing_started_at for timeout detection
-- If a transaction is stuck > 5 minutes, it's safe to retry
ALTER TABLE sales ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- Function to clean old idempotency keys (run daily via cron)
CREATE OR REPLACE FUNCTION clean_old_idempotency_keys()
RETURNS void AS $$
BEGIN
  -- Clear idempotency keys older than 24 hours
  UPDATE sales SET idempotency_key = NULL 
  WHERE idempotency_key IS NOT NULL 
    AND created_at < NOW() - INTERVAL '24 hours';
    
  UPDATE invoices SET idempotency_key = NULL 
  WHERE idempotency_key IS NOT NULL 
    AND created_at < NOW() - INTERVAL '24 hours';
    
  UPDATE payments SET idempotency_key = NULL 
  WHERE idempotency_key IS NOT NULL 
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON COLUMN sales.idempotency_key IS 'Unique key per tenant to prevent duplicate submissions from rapid clicks or network retries';
COMMENT ON COLUMN sales.processing_started_at IS 'When this sale started processing (for timeout detection)';
