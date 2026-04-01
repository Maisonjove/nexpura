-- Pilot Issues Security Tightening
-- Created: 2026-04-01
-- Restrict access to owner/admin only at DB level

-- Add assignee fields
ALTER TABLE pilot_issues ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE pilot_issues ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id);

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS pilot_issues_select ON pilot_issues;
DROP POLICY IF EXISTS pilot_issues_insert ON pilot_issues;
DROP POLICY IF EXISTS pilot_issues_update ON pilot_issues;

-- Create owner-only policies
-- Access is restricted to users with role = 'owner' only

-- Policy: Only owners can select
CREATE POLICY pilot_issues_owner_select ON pilot_issues
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Policy: Only owners can insert
CREATE POLICY pilot_issues_owner_insert ON pilot_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Policy: Only owners can update
CREATE POLICY pilot_issues_owner_update ON pilot_issues
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Policy: Only owners can delete
CREATE POLICY pilot_issues_owner_delete ON pilot_issues
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Index for assignee queries
CREATE INDEX IF NOT EXISTS idx_pilot_issues_assigned ON pilot_issues(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;

COMMENT ON TABLE pilot_issues IS 'Internal pilot issue tracking. Access restricted to platform owners only.';
