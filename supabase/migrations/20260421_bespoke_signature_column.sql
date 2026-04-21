-- =====================================================
-- BESPOKE APPROVAL SIGNATURE COLUMN — 2026-04-21
-- =====================================================
--
-- The /api/bespoke/approval-response route writes the customer's
-- digital-signature canvas data to client_signature_data on the
-- bespoke_jobs row. During the 2026-04-21 sandbox verification the
-- endpoint returned HTTP 500 because that column wasn't in the live
-- schema ("Could not find the 'client_signature_data' column of
-- 'bespoke_jobs' in the schema cache") — so every customer Approve
-- click silently rolled back, the approval_status stayed 'pending',
-- the job_events row never wrote, and the jeweller saw no signal that
-- the customer had approved.
--
-- Adding the column here + patching the API handler in the same pass
-- (see src/app/api/bespoke/approval-response/route.ts — the handler
-- now writes the signature into approval_notes as a fallback so
-- approvals survive even when this migration hasn't been applied).
-- =====================================================

ALTER TABLE public.bespoke_jobs
  ADD COLUMN IF NOT EXISTS client_signature_data text;

COMMENT ON COLUMN public.bespoke_jobs.client_signature_data IS
  'Customer-facing approval page stores the canvas-drawn signature here as a data URL. Written by /api/bespoke/approval-response on action=approve. Nullable — older rows pre-date the approval flow and pre-2026-04-21 rows where the column was missing survived via approval_notes fallback.';
