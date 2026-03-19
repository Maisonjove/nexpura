-- Transaction Audit Table
-- Tracks multi-step operations for forensic recovery and partial state detection

CREATE TABLE IF NOT EXISTS transaction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,  -- 'pos_sale', 'refund', 'layby_completion', 'intake_create'
  entity_id TEXT NOT NULL,       -- ID of the primary entity being modified
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'failed', 'error'
  steps_planned TEXT[] NOT NULL DEFAULT '{}',
  steps_completed TEXT[] NOT NULL DEFAULT '{}',
  failed_step TEXT,
  error TEXT,
  rollback_attempted BOOLEAN DEFAULT false,
  rollback_errors TEXT[],
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for detecting stale in-progress transactions
CREATE INDEX idx_transaction_audit_incomplete 
  ON transaction_audit(tenant_id, status, started_at) 
  WHERE status = 'in_progress';

-- Index for entity lookup
CREATE INDEX idx_transaction_audit_entity 
  ON transaction_audit(tenant_id, entity_id);

-- RLS
ALTER TABLE transaction_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's audit records"
  ON transaction_audit FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert audit records for their tenant"
  ON transaction_audit FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update audit records for their tenant"
  ON transaction_audit FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Comment
COMMENT ON TABLE transaction_audit IS 
  'Tracks multi-step operations for forensic recovery. Detects partial state from server crashes.';
