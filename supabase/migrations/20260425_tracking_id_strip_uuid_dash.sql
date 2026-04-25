-- Fix tracking_id generator: strip UUID dashes before slicing.
--
-- The previous version (20260424_tracking_id_entropy) did:
--   UPPER(SUBSTRING(gen_random_uuid()::text, 1, 12))
--
-- gen_random_uuid()::text is `xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx`,
-- so chars 1-12 include the first dash and produce e.g.
-- `BSP-6EBCFCFE-C18` (8 hex + dash + 3 hex). The page-side validator
-- (`^(RPR|BSP)-[A-F0-9]{8,12}$`, src/app/track/[trackingId]/page.tsx
-- + src/lib/messaging.ts) doesn't allow an internal dash, so every
-- new tracking_id since 2026-04-24 returned "Order Not Found" on
-- /track. Pre-existing 8-char IDs were unaffected.
--
-- Fix: drop the dashes from the UUID text first, THEN slice 12 hex
-- chars. Same 48 bits of entropy, valid format.
--
-- Also backfills the small set of already-broken IDs to fresh valid
-- ones so customer links that have already been emailed start
-- resolving (no dash → re-roll).
CREATE OR REPLACE FUNCTION public.generate_tracking_id(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_tracking_id(TEXT) IS
  '12 hex chars ≈ 48 bits of entropy. Widened from 8 on 2026-04-24, '
  'fixed on 2026-04-25 to strip UUID-text dashes before slicing so '
  'the suffix is always valid against the app-side regex '
  '^(RPR|BSP)-[A-F0-9]{8,12}$. Existing 8-char tracking_ids remain '
  'valid; 12-char-with-internal-dash IDs are migrated forward.';

-- Backfill: regenerate any tracking_id that contains a dash inside
-- the suffix. There are very few of these (intakes from the 24h
-- window between the entropy migration and this fix) so a single
-- update is fine without a chunked job.
UPDATE public.repairs
SET tracking_id = public.generate_tracking_id('RPR')
WHERE tracking_id ~ '^(RPR|BSP)-[A-F0-9]+-.+$';

UPDATE public.bespoke_jobs
SET tracking_id = public.generate_tracking_id('BSP')
WHERE tracking_id ~ '^(RPR|BSP)-[A-F0-9]+-.+$';
