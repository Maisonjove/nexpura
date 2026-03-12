ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS is_admin_gifted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_24h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_checkout_link TEXT;
