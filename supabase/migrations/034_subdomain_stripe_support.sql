-- 034_subdomain_stripe_support.sql
-- Adds subdomain support for multi-tenant routing and Stripe subscription tracking

-- Add subdomain column to tenants (this becomes the canonical tenant identifier for routing)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Create index for fast subdomain lookups
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);

-- Add Stripe subscription tracking to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add plan column to tenants (denormalized from subscriptions for faster access)
-- Values: boutique | studio | atelier
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'boutique';

-- Migrate existing tenants: use slug as subdomain where subdomain is null
UPDATE public.tenants SET subdomain = slug WHERE subdomain IS NULL;
