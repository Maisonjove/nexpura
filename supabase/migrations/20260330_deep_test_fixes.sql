-- Migration: Deep Test Fixes (2026-03-30)
-- Fixes:
-- 1. Standardize deposit_paid → deposit_received for bespoke_jobs
-- 2. Add commission_rate to team_members

-- ============================================================
-- ISSUE 1: Bespoke Job deposit_paid → deposit_received migration
-- ============================================================
-- Copy deposit_paid=true values to deposit_received (don't lose data)
UPDATE public.bespoke_jobs
SET deposit_received = TRUE
WHERE deposit_paid = TRUE AND (deposit_received = FALSE OR deposit_received IS NULL);

-- Drop the deposit_paid column (deposit_received is the canonical field)
ALTER TABLE public.bespoke_jobs DROP COLUMN IF EXISTS deposit_paid;

-- ============================================================
-- ISSUE 4: Commission Tracking - Add commission_rate to team_members
-- ============================================================
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN public.team_members.commission_rate IS 'Commission percentage for this team member (0-100). Applied to sales they process.';
