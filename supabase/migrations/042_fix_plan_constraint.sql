-- 042_fix_plan_constraint.sql
-- Fix subscriptions table plan CHECK constraint to match actual plan names used in the app
-- (boutique | studio | atelier, not the old basic | pro | ultimate)

-- Drop the old constraint
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Add the correct constraint matching the app's plan names
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('boutique', 'studio', 'atelier'));

-- Migrate any existing rows with old plan names (safety migration)
UPDATE public.subscriptions SET plan = 'boutique' WHERE plan = 'basic';
UPDATE public.subscriptions SET plan = 'studio'   WHERE plan = 'pro';
UPDATE public.subscriptions SET plan = 'atelier'  WHERE plan = 'ultimate';

-- Also ensure tenants.plan column only allows valid values
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('boutique', 'studio', 'atelier'));
