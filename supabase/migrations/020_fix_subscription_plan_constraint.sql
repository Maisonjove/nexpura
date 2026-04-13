-- 020_fix_subscription_plan_constraint.sql
-- ============================================================
-- CRITICAL FIX: subscription plan column constraint
-- ============================================================
-- Migration 001 constrained plan to ('basic','pro','ultimate').
-- The application code (completeOnboarding, plans.ts) uses
-- ('boutique','studio','atelier'). This mismatch causes every
-- new account creation to fail with a CHECK constraint violation.
-- ============================================================

-- Drop the old constraint
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Add updated constraint that accepts the app's actual plan IDs.
-- Legacy values ('basic','pro','ultimate') are kept so any existing
-- rows aren't invalidated.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('boutique', 'studio', 'atelier', 'basic', 'pro', 'ultimate'));

-- Update the column default to match the new naming
ALTER TABLE public.subscriptions
  ALTER COLUMN plan SET DEFAULT 'boutique';
