-- The SMS-2FA flow (src/app/api/auth/2fa/sms/{setup,verify,send-login,disable}
-- + the /settings/two-factor page) was added in code but no migration ever
-- introduced its supporting users-table columns. Production was reading
-- `sms_2fa_enabled, sms_2fa_phone` against the users row on every visit
-- to /settings/two-factor and getting:
--   GET /rest/v1/users?select=...,sms_2fa_enabled,...,sms_2fa_phone,... -> 400
--   "column users.sms_2fa_enabled does not exist"
-- which surfaced as a console error on every visitor's settings page.
--
-- This migration introduces the two missing columns. Defaults preserve
-- the current behavior (SMS-2FA off for existing users); enabling
-- requires going through the existing setup flow.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sms_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_2fa_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_users_sms_2fa_enabled
  ON public.users(sms_2fa_enabled) WHERE sms_2fa_enabled = true;

COMMENT ON COLUMN public.users.sms_2fa_enabled IS
  'Whether SMS-based 2FA is enrolled for this user (mutually exclusive with totp_enabled in the UI flow).';
COMMENT ON COLUMN public.users.sms_2fa_phone IS
  'E.164 phone number that receives 2FA codes when sms_2fa_enabled = true.';
