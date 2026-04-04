-- Email bounce tracking columns for customers
-- Tracks email delivery status to prevent sending to invalid addresses

-- Add email status tracking to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'active' CHECK (email_status IN ('active', 'bounced', 'complained'));

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS email_opted_out BOOLEAN DEFAULT false;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS email_opted_out_at TIMESTAMPTZ;

-- Index for filtering out bounced emails in bulk sends
CREATE INDEX IF NOT EXISTS idx_customers_email_status 
ON customers(tenant_id, email_status) 
WHERE email_status != 'active';

-- Add bounce_reason to email_logs for debugging
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

COMMENT ON COLUMN customers.email_status IS 'active=ok to send, bounced=invalid address, complained=marked as spam';
COMMENT ON COLUMN customers.email_opted_out IS 'true if customer should never receive marketing emails';
