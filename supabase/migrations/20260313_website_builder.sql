-- 20260313_website_builder.sql
-- Website builder tables for tenant storefronts

-- ============================================================
-- WEBSITE CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'A',  -- A: catalogue only, B: catalogue + enquiry, C: full store
  published boolean DEFAULT false,
  subdomain text UNIQUE,           -- e.g. "goldsmith" → goldsmith.nexpura.com
  custom_domain text,

  -- Branding
  business_name text,
  tagline text,
  logo_url text,
  hero_image_url text,

  -- Theme
  primary_color text DEFAULT '#8B7355',
  secondary_color text DEFAULT '#1A1A1A',
  font text DEFAULT 'Inter',

  -- Content
  about_text text,
  contact_email text,
  contact_phone text,
  contact_address text,
  social_instagram text,
  social_facebook text,

  -- Mode C (store) settings
  stripe_enabled boolean DEFAULT false,
  show_prices boolean DEFAULT true,
  allow_enquiry boolean DEFAULT true,

  -- SEO
  meta_title text,
  meta_description text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_config_tenant ON public.website_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_website_config_subdomain ON public.website_config(subdomain);

ALTER TABLE public.website_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='website_config' AND policyname='website_config_tenant_isolation') THEN
    CREATE POLICY "website_config_tenant_isolation" ON public.website_config
      FOR ALL USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

DROP TRIGGER IF EXISTS website_config_updated_at ON public.website_config;
CREATE TRIGGER website_config_updated_at
  BEFORE UPDATE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- WEBSITE PAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_pages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  content jsonb DEFAULT '[]',  -- array of content blocks
  published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_pages_tenant ON public.website_pages(tenant_id);

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='website_pages' AND policyname='website_pages_tenant_isolation') THEN
    CREATE POLICY "website_pages_tenant_isolation" ON public.website_pages
      FOR ALL USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ============================================================
-- Update communications type to allow website_enquiry
-- ============================================================
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_type_check;
ALTER TABLE public.communications ADD CONSTRAINT communications_type_check
  CHECK (type IN ('email','sms','note','website_enquiry'));
