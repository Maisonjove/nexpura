-- Demo-request capture (Joey 2026-05-04). Extends the existing
-- /contact?intent=demo flow (Kaitlyn 2026-04-28) with structured row
-- storage so /admin/demo-requests can manage the lifecycle:
-- new → scheduled → completed | declined.
--
-- /api/contact stays the entry point — when topic='demo' it now also
-- inserts a row here in addition to the email it already sends.
--
-- RLS: platform-admin (super_admins + isAllowlistedAdmin) only. No
-- tenant scope — demo prospects are pre-tenant.

CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard contact fields (mirror /api/contact's contactSchema)
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  country TEXT NOT NULL DEFAULT 'AU',
  message TEXT,

  -- Demo-specific fields Kaitlyn's form already collects
  current_pos TEXT,
  num_stores TEXT,
  pain_point TEXT,
  preferred_time TEXT,
  plan TEXT,                   -- /pricing → /contact?intent=demo&plan=X passes this

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'scheduled', 'completed', 'declined')),
  zoom_link TEXT,
  scheduled_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Forensics
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS demo_requests_status_idx ON demo_requests (status);
CREATE INDEX IF NOT EXISTS demo_requests_created_at_idx ON demo_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS demo_requests_email_idx ON demo_requests (LOWER(email));

-- updated_at trigger
CREATE OR REPLACE FUNCTION demo_requests_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS demo_requests_updated_at ON demo_requests;
CREATE TRIGGER demo_requests_updated_at
  BEFORE UPDATE ON demo_requests
  FOR EACH ROW EXECUTE FUNCTION demo_requests_set_updated_at();

-- RLS: only super_admins can SELECT/UPDATE. INSERT goes through the
-- service-role client from /api/contact (bypasses RLS). No tenant
-- scope — demo prospects are pre-tenant.
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY demo_requests_super_admin_select
  ON demo_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

CREATE POLICY demo_requests_super_admin_update
  ON demo_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

COMMENT ON TABLE demo_requests IS
  'Demo-request capture from /contact?intent=demo. Lifecycle: new → scheduled → completed | declined. Platform-admin only (no tenant scope, prospects are pre-tenant).';
