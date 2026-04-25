-- SMS 2FA flow needs code-pending state to verify the user owns the
-- phone they entered. The code in
--   /api/auth/2fa/sms/setup
--   /api/auth/2fa/sms/send-login
--   /api/auth/2fa/sms/verify-login
-- already writes/reads sms_2fa_code, sms_2fa_code_expires_at,
-- sms_2fa_phone_pending — but those columns didn't exist on the
-- live schema. Result: setup/send 500'd, verify always returned
-- "No verification code pending", so the entire SMS 2FA flow was
-- non-functional end-to-end.
--
-- Add the columns. Idempotent — safe to re-apply.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sms_2fa_code TEXT,
  ADD COLUMN IF NOT EXISTS sms_2fa_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_2fa_phone_pending TEXT;

-- Index helps the verify path scan to expire stale codes quickly.
CREATE INDEX IF NOT EXISTS idx_users_sms_2fa_code_expires
  ON public.users (sms_2fa_code_expires_at)
  WHERE sms_2fa_code IS NOT NULL;
