-- Employee credentials tracking — Group 14 audit.
--
-- Why: /verification page existed as an in-memory static QA checklist
-- (pre-go-live verification list). Joey's audit spec called for
-- employee credentials tracking with expiry warnings — a real feature
-- that didn't exist. This migration creates the backing table; the
-- page is rewritten to use it.
--
-- Each row is a single credential held by one team member: cert,
-- license, training. Tenant-scoped via tenant_id; user_id references
-- the public.users row, not auth.users, so a deleted auth account
-- doesn't accidentally break the FK chain on the visible record.

CREATE TABLE IF NOT EXISTS employee_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- employee_name is captured separately so a credential survives
  -- deletion of the user row (records-keeping requirement).
  employee_name TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  issuer TEXT,
  issued_date DATE,
  expiry_date DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_credentials_tenant ON employee_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS employee_credentials_expiry ON employee_credentials(tenant_id, expiry_date);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_employee_credentials_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS employee_credentials_updated_at ON employee_credentials;
CREATE TRIGGER employee_credentials_updated_at
  BEFORE UPDATE ON employee_credentials
  FOR EACH ROW EXECUTE FUNCTION set_employee_credentials_updated_at();

-- RLS — staff in tenant A see only their tenant's credentials.
ALTER TABLE employee_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_credentials_select ON employee_credentials;
CREATE POLICY employee_credentials_select ON employee_credentials
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS employee_credentials_modify ON employee_credentials;
CREATE POLICY employee_credentials_modify ON employee_credentials
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
