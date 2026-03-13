-- 20260313_website_builder_v2.sql
-- Extend website_config with multi-mode support

ALTER TABLE public.website_config
  ADD COLUMN IF NOT EXISTS website_type text DEFAULT 'hosted',
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_platform text,
  ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false;

-- website_type: 'hosted' | 'connect' | 'domain-guide'
-- external_url: the user's existing website URL (for 'connect' mode)
-- external_platform: 'squarespace' | 'wix' | 'shopify' | 'wordpress' | 'webflow' | 'other'
-- domain_verified: whether the custom_domain CNAME has been verified
