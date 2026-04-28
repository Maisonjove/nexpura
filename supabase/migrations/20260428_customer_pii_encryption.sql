-- ============================================================
-- W6-HIGH-14: Column-level encryption scaffolding for customers PII
--
-- Audit follow-up (2026-04-28): the customers table holds plaintext
-- address (line + suburb + state + postcode + country + legacy
-- single-line `address`), notes, and personal preferences (ring_size,
-- preferred_metal, preferred_stone). A backup/snapshot/support-dump
-- leak would expose every jeweller's customer book.
--
-- This migration adds a single jsonb column `pii_enc` that holds an
-- AES-GCM-256 sealed bundle of those fields (one seal per row, not
-- per field — saves IVs and round-trip overhead). Read + write
-- helpers in src/lib/customer-pii.ts.
--
-- DEFERRED (not in scope for this migration):
--   - email / phone / mobile — equality lookup needed → hash columns
--     already exist (email_hash / phone_hash from 20260401) but are
--     not yet wired. Future PR.
--   - full_name / first_name / last_name — used in ILIKE search and
--     sort order. Needs searchable encryption or FTS rebuild.
--   - birthday / anniversary — date-range queried by reminders page.
--
-- Plain columns are NOT dropped. The writer double-writes (plaintext
-- + encrypted) for one release so:
--   (a) readers that haven't been updated continue to see plaintext
--   (b) backfill is reversible
-- A follow-up migration drops plaintext columns once all readers are
-- confirmed live.
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS pii_enc jsonb;

COMMENT ON COLUMN public.customers.pii_enc IS
  'AES-GCM-256 sealed bundle of address + notes + preferences. ' ||
  'Decrypt via decryptCustomerPii() at the render boundary. ' ||
  'W6-HIGH-14 (20260428).';
