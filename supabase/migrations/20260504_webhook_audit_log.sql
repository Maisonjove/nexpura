-- P2-F audit follow-on (Joey 2026-05-04). Persistent audit trail for
-- every external webhook delivery, regardless of whether the
-- signature passed. Vercel runtime logs only retain ~24h, which isn't
-- enough for forensic investigation of webhook spoofing attempts or
-- delayed-discovery delivery failures.
--
-- Every external POST to a webhook handler now writes one row here:
--   - signature_status='valid'             — sig OK, event processed (or about to be)
--   - signature_status='invalid_signature' — sig header present but wrong/tampered
--   - signature_status='missing_signature' — header missing entirely
--   - signature_status='missing_headers'   — required envelope headers missing
--                                            (Woo: x-wc-webhook-topic / source)
--   - signature_status='not_configured'    — webhook secret/key not set
--                                            (the 503 response path)
--
-- Body is NOT stored — payload_hash (sha256 of body) is used for dedup
-- + correlation only. Storing full bodies would balloon the table on a
-- platform that processes thousands of Stripe events / month and would
-- mean any PII from customer payloads sits here too.
--
-- 90-day retention via pg_cron (extension already installed). Older
-- rows are auto-pruned at the bottom of this migration.
--
-- RLS: super_admin SELECT only. INSERT-only via the service-role
-- (admin) client from webhook handlers — no anon/authenticated path.
-- This keeps the audit table read-restricted to platform admin while
-- letting webhook handlers write freely (RLS bypass via service role).

CREATE TABLE IF NOT EXISTS webhook_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handler_name TEXT NOT NULL
    CHECK (handler_name IN ('stripe', 'stripe_marketing', 'resend', 'woocommerce')),
  signature_status TEXT NOT NULL
    CHECK (signature_status IN (
      'valid',
      'invalid_signature',
      'missing_signature',
      'missing_headers',
      'not_configured'
    )),
  request_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  payload_hash TEXT,                -- sha256 hex digest of the body
  event_id TEXT,                    -- when extractable (Stripe event.id, Svix svix-id, etc.)
  event_type TEXT,                  -- when extractable (customer.subscription.updated, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot indexes — queries we'll run against this table:
-- (a) "show me all rejections in the last hour" → filtered by status + recency
CREATE INDEX IF NOT EXISTS webhook_audit_log_status_created_at_idx
  ON webhook_audit_log (signature_status, created_at DESC);
-- (b) "find all events with hash X" → dedup / replay investigation
CREATE INDEX IF NOT EXISTS webhook_audit_log_payload_hash_idx
  ON webhook_audit_log (payload_hash) WHERE payload_hash IS NOT NULL;
-- (c) "find all attempts for event Y" → following a specific Stripe event end-to-end
CREATE INDEX IF NOT EXISTS webhook_audit_log_event_id_idx
  ON webhook_audit_log (event_id) WHERE event_id IS NOT NULL;
-- (d) "blanket recency scan for the prune cron" + super_admin time-range queries
CREATE INDEX IF NOT EXISTS webhook_audit_log_created_at_idx
  ON webhook_audit_log (created_at DESC);

-- RLS: super_admins can read; service-role bypasses for inserts.
ALTER TABLE webhook_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_audit_log_super_admin_select
  ON webhook_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- 90-day prune cron. pg_cron is already installed on this project
-- (extension verified pre-migration). Runs daily at 03:00 UTC.
SELECT cron.schedule(
  'webhook_audit_log_prune',
  '0 3 * * *',
  $$DELETE FROM webhook_audit_log WHERE created_at < NOW() - INTERVAL '90 days';$$
);

COMMENT ON TABLE webhook_audit_log IS
  'Forensic audit trail for inbound webhook deliveries (signature attempts + valid traffic). Body NOT stored — payload_hash only. 90-day retention via pg_cron. Super-admin SELECT only.';
