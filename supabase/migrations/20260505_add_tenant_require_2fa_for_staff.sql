-- M-05 (desktop-Opus): tenant-level 2FA enforcement for staff.
--
-- Owner can toggle this on per-tenant. When ON, staff (role=staff /
-- non-owner-non-manager — and explicitly EXCLUDING the platform-
-- allowlisted admin germanijoey@yahoo.com whose tenant_id is NULL)
-- cannot reach the app shell after login until they enrol TOTP via
-- /settings/two-factor.
--
-- Default FALSE — opt-in. Existing tenants are unchanged.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS require_2fa_for_staff BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.tenants.require_2fa_for_staff IS
  'M-05: when TRUE, staff (non-owner) cannot complete sign-in until '
  'TOTP is enrolled. Owners are exempt — they are the ones who own '
  'the toggle. Owners should still enrol but blocking themselves '
  'risks a permanent lockout.';
