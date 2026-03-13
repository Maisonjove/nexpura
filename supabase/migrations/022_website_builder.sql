-- 022_website_builder.sql
-- Site pages and sections for the real website builder

CREATE TABLE IF NOT EXISTS public.site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'custom',
  -- 'home' | 'about' | 'contact' | 'policies' | 'collection' | 'product'
  -- | 'appointment' | 'custom_enquiry' | 'repair_enquiry' | 'custom'
  meta_title TEXT,
  meta_description TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.site_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.site_pages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  -- 'hero' | 'text' | 'image_text' | 'gallery' | 'product_grid'
  -- | 'collection_grid' | 'testimonials' | 'contact_form' | 'enquiry_form'
  -- | 'repair_form' | 'appointment_form' | 'faq' | 'divider' | 'spacer'
  display_order INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '{}',
  styles JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_pages_tenant ON public.site_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_sections_page ON public.site_sections(page_id);
CREATE INDEX IF NOT EXISTS idx_site_sections_tenant ON public.site_sections(tenant_id);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_pages' AND policyname='sp_select') THEN
    CREATE POLICY "sp_select" ON public.site_pages FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_pages' AND policyname='sp_insert') THEN
    CREATE POLICY "sp_insert" ON public.site_pages FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_pages' AND policyname='sp_update') THEN
    CREATE POLICY "sp_update" ON public.site_pages FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_pages' AND policyname='sp_delete') THEN
    CREATE POLICY "sp_delete" ON public.site_pages FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_sections' AND policyname='ss_select') THEN
    CREATE POLICY "ss_select" ON public.site_sections FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_sections' AND policyname='ss_insert') THEN
    CREATE POLICY "ss_insert" ON public.site_sections FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_sections' AND policyname='ss_update') THEN
    CREATE POLICY "ss_update" ON public.site_sections FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_sections' AND policyname='ss_delete') THEN
    CREATE POLICY "ss_delete" ON public.site_sections FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;
