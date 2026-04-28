-- ============================================================
-- W6-HIGH-13: Column-level encryption for tenants.bank_bsb + bank_account
--
-- Audit finding (2026-04-28): Australian BSB + bank account number
-- were stored plaintext in `tenants.bank_bsb` / `tenants.bank_account`
-- and rendered on every invoice PDF. A backup leak, support dump, or
-- read-only DB compromise would expose every jeweller's customers'
-- banking info — direct compliance hit (PCI-DSS-adjacent + AU privacy
-- obligations).
--
-- This migration adds parallel encrypted columns that store
-- { v, c, i } — AES-GCM-256 ciphertext + IV + version, sealed with
-- NEXPURA_INTEGRATIONS_ENCRYPTION_KEY at the application layer
-- (see src/lib/crypto/secretbox.ts and src/lib/tenant-banking.ts).
--
-- The plaintext columns are NOT dropped in this migration. They stay
-- for one release so:
--   (a) the one-time re-encrypt script can read them
--   (b) any missed call-site reads stale data instead of erroring
--
-- MANUAL STEP after this migration ships:
--   1. Run `scripts/encrypt-bank-details.ts` once against production
--      to encrypt existing rows and null the plaintext columns.
--   2. In a follow-up release, a future migration will drop the
--      plaintext columns once all readers have been verified to use
--      decryptBankDetails().
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bank_bsb_enc jsonb,
  ADD COLUMN IF NOT EXISTS bank_account_enc jsonb;

COMMENT ON COLUMN public.tenants.bank_bsb_enc IS
  'AES-GCM-256 sealed BSB { v, c, i }. Decrypt at the render boundary only via decryptBankDetails(). W6-HIGH-13 (20260428).';

COMMENT ON COLUMN public.tenants.bank_account_enc IS
  'AES-GCM-256 sealed bank account number { v, c, i }. Decrypt at the render boundary only via decryptBankDetails(). W6-HIGH-13 (20260428).';
