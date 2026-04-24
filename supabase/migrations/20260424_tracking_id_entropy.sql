-- =====================================================
-- Widen tracking_id entropy: 8 hex → 12 hex for NEW records.
--
-- Audit finding (Medium, M-tracking-id-entropy):
--   generate_tracking_id() produced an 8-char hex suffix (32 bits of
--   entropy, ~4 billion possible ids). With a public /track/[id]
--   surface and a reasonably-sized tenant population, birthday-bound
--   guessing gets scary. Bump to 12 hex chars (48 bits, ~281 trillion)
--   — still fits comfortably in the column, still human-typeable, and
--   is a ~16-million× improvement in brute-force resistance.
--
-- This migration:
--   1. CREATE OR REPLACE the generator to use 12 hex chars.
--   2. Does NOT backfill existing tracking_ids. The format validator in
--      /src/app/track/[trackingId]/page.tsx accepts {8,12} length so
--      old and new tracking ids coexist.
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_tracking_id(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 12));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_tracking_id(TEXT) IS
  '12 hex chars ≈ 48 bits of entropy. Widened from 8 on 2026-04-24. '
  'Existing 8-char tracking_ids remain valid; the app-side regex '
  'accepts both lengths.';
