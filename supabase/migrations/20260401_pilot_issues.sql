-- Pilot Issues Triage System
-- Created: 2026-04-01
-- Internal bug tracking for controlled pilot

CREATE TABLE IF NOT EXISTS pilot_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core issue fields
  title TEXT NOT NULL,
  description TEXT,
  route_path TEXT,  -- e.g. /pos, /repairs/[id]
  
  -- Classification
  category TEXT NOT NULL DEFAULT 'other',
  severity TEXT NOT NULL DEFAULT 'medium',  -- critical, high, medium, low
  status TEXT NOT NULL DEFAULT 'new',  -- new, needs_repro, confirmed, in_progress, fixed, retest_needed, closed, not_a_bug
  is_pilot_blocking BOOLEAN DEFAULT FALSE,
  
  -- Reporter info
  reported_by TEXT,  -- name or email
  reported_by_user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  tenant_name TEXT,  -- denormalized for quick display
  
  -- Reproduction
  steps_to_reproduce TEXT,
  expected_result TEXT,
  actual_result TEXT,
  
  -- Fix tracking
  fix_notes TEXT,
  fixed_by TEXT,
  fixed_at TIMESTAMPTZ,
  fixed_in_commit TEXT,
  
  -- Attachments (stored as array of URLs)
  attachments TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pilot_issues_status ON pilot_issues(status);
CREATE INDEX IF NOT EXISTS idx_pilot_issues_severity ON pilot_issues(severity);
CREATE INDEX IF NOT EXISTS idx_pilot_issues_category ON pilot_issues(category);
CREATE INDEX IF NOT EXISTS idx_pilot_issues_created ON pilot_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_issues_tenant ON pilot_issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pilot_issues_blocking ON pilot_issues(is_pilot_blocking) WHERE is_pilot_blocking = TRUE;

-- Composite index for open critical/high issues
CREATE INDEX IF NOT EXISTS idx_pilot_issues_critical_open 
  ON pilot_issues(severity, status) 
  WHERE status NOT IN ('closed', 'not_a_bug', 'fixed');

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_pilot_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pilot_issues_updated_at ON pilot_issues;
CREATE TRIGGER pilot_issues_updated_at
  BEFORE UPDATE ON pilot_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_pilot_issues_updated_at();

-- RLS: Only accessible by authenticated users (internal tool)
ALTER TABLE pilot_issues ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can view
CREATE POLICY pilot_issues_select ON pilot_issues
  FOR SELECT TO authenticated
  USING (TRUE);

-- Policy: Any authenticated user can insert
CREATE POLICY pilot_issues_insert ON pilot_issues
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Policy: Any authenticated user can update
CREATE POLICY pilot_issues_update ON pilot_issues
  FOR UPDATE TO authenticated
  USING (TRUE);
