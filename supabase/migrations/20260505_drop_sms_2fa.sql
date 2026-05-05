-- PR-P2A-sms-removal: drop SMS 2FA columns from public.users.
-- Background: SMS 2FA was decorative (no middleware enforcement), had P0/P1
-- bugs, and 0 users had it enabled. Removed in favour of TOTP-only.
-- All 5 columns are unused post code-removal.

ALTER TABLE public.users
  DROP COLUMN IF EXISTS sms_2fa_enabled,
  DROP COLUMN IF EXISTS sms_2fa_phone,
  DROP COLUMN IF EXISTS sms_2fa_phone_pending,
  DROP COLUMN IF EXISTS sms_2fa_code,
  DROP COLUMN IF EXISTS sms_2fa_code_expires_at;
