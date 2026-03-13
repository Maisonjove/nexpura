-- 011_fix_subscription_status.sql
-- Add missing subscription status values (remove old check, add new one)

ALTER TABLE public.subscriptions 
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions 
  ADD CONSTRAINT subscriptions_status_check 
  CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'payment_required', 'suspended'));
