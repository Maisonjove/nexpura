-- ============================================================
-- W6-HIGH-12: Column-level encryption for integrations.config
--
-- OAuth access tokens and webhook secrets (Shopify, WooCommerce,
-- Xero, Mailchimp, Google Calendar, WhatsApp, insurance) were
-- stored verbatim in the `integrations.config` jsonb column. A
-- database leak (snapshot, support dump, backup theft) would hand
-- an attacker every merchant's provider account.
--
-- This migration adds a parallel `config_encrypted` jsonb column
-- that stores { v, c, i } — AES-GCM-256 ciphertext + IV + version,
-- sealed with NEXPURA_INTEGRATIONS_ENCRYPTION_KEY at the
-- application layer (see src/lib/crypto/secretbox.ts).
--
-- The plaintext `config` column is NOT dropped in this migration.
-- It stays for one release so:
--   (a) the one-time re-encrypt script can read it
--   (b) any missed call-site still fails open (legacy fallthrough)
--
-- MANUAL STEP after this migration ships:
--   1. Set NEXPURA_INTEGRATIONS_ENCRYPTION_KEY in Vercel prod env
--      (base64 of 32 random bytes). Redeploy.
--   2. Run `scripts/encrypt-integrations-config.ts` once against
--      production to encrypt existing rows and blank the legacy
--      `config` column.
--   3. In the next release, a follow-up migration
--      `20260XXX_drop_integrations_config_legacy.sql` will drop
--      the plaintext column.
-- ============================================================

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS config_encrypted jsonb;

COMMENT ON COLUMN public.integrations.config_encrypted IS
  'AES-GCM-256 sealed config payload { v, c, i }. Decrypt at ' ||
  'integration-client boundary only. See src/lib/crypto/secretbox.ts. ' ||
  'W6-HIGH-12 remediation (20260423).';

-- Unique tenant-type index is already in place; nothing else to do at SQL level.
