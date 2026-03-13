-- 018_grace_period.sql
-- Grace period and free account support on tenants

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS payment_required_notified_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_free_forever BOOLEAN DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

-- The subscriptions table already has grace_period_ends_at, grace_24h_sent from migration 009
-- This adds tenant-level tracking for quick suspension checks
