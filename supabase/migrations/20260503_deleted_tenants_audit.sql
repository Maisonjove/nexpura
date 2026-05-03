-- P2-E audit (Joey 2026-05-03): GDPR deletion cron audit trail.
--
-- The /api/data-delete endpoint accepts a tenant deletion request,
-- sets tenants.deletion_requested_at + deletion_scheduled_for (T+30
-- days), and tells the customer their data will be deleted. Pre-fix
-- there was NO cron that actually executed the deletion at T+30 —
-- the GDPR feature was decorative.
--
-- The new /api/cron/process-tenant-deletions cron will execute the
-- deletion. After the tenants row + cascading 87 child tables are
-- gone, we lose all trace of the deletion ever happening — which
-- breaks GDPR accountability requirements (Article 30 records of
-- processing activities).
--
-- This table preserves the audit trail INDEFINITELY (no FK to
-- tenants, so it survives the tenant DELETE). One row per executed
-- deletion. Joey can query it later to prove which tenants were
-- deleted, when, and that the right child rows were purged.

CREATE TABLE IF NOT EXISTS deleted_tenants_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original tenant identity (frozen at deletion time)
  original_tenant_id UUID NOT NULL,
  tenant_name TEXT,
  owner_email TEXT,

  -- Lifecycle timestamps
  deletion_requested_at TIMESTAMPTZ NOT NULL,
  deletion_scheduled_for TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Storage cleanup tally
  files_purged_count INTEGER NOT NULL DEFAULT 0,
  files_purge_errors TEXT,

  -- DB cascade tally (for sanity checking the FK CASCADE actually
  -- did its job — captured by counting rows BEFORE the delete via
  -- a few representative tables).
  pre_delete_row_counts JSONB,

  -- Cron run that processed this row
  processed_by_cron_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deleted_tenants_audit_tenant_id_idx
  ON deleted_tenants_audit (original_tenant_id);
CREATE INDEX IF NOT EXISTS deleted_tenants_audit_deleted_at_idx
  ON deleted_tenants_audit (deleted_at DESC);

-- RLS: only platform admin (super_admins / allowlisted) can read.
-- Service role bypasses RLS so the cron writes freely. We're
-- intentionally NOT exposing this to tenant members — once their
-- tenant is deleted, they have no session anyway, and their own
-- record of the deletion is the email confirmation we send.
ALTER TABLE deleted_tenants_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY deleted_tenants_audit_super_admin_read
  ON deleted_tenants_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE deleted_tenants_audit IS
  'GDPR Article 30 deletion audit trail. Permanent retention — preserves the record of WHICH tenant was deleted WHEN, even after the tenants row + cascaded child rows are gone. Written by the /api/cron/process-tenant-deletions cron.';
