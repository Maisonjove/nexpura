-- Add barcode to inventory if not exists
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS barcode_value TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Stock tag templates
CREATE TABLE IF NOT EXISTS public.stock_tag_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  width_mm INTEGER NOT NULL DEFAULT 50,
  height_mm INTEGER NOT NULL DEFAULT 25,
  orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('portrait', 'landscape')),
  show_price BOOLEAN DEFAULT true,
  show_sku BOOLEAN DEFAULT true,
  show_barcode BOOLEAN DEFAULT true,
  show_qr BOOLEAN DEFAULT false,
  show_metal BOOLEAN DEFAULT true,
  show_stone BOOLEAN DEFAULT false,
  show_weight BOOLEAN DEFAULT false,
  show_store_name BOOLEAN DEFAULT true,
  font_size_name INTEGER DEFAULT 10,
  font_size_details INTEGER DEFAULT 7,
  font_size_price INTEGER DEFAULT 11,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.stock_tag_templates (tenant_id, name, width_mm, height_mm, orientation, is_default)
SELECT id, 'Ring Tag', 50, 25, 'landscape', true FROM public.tenants
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tag_templates_tenant ON public.stock_tag_templates(tenant_id);
ALTER TABLE public.stock_tag_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_templates_tenant" ON public.stock_tag_templates FOR ALL USING (tenant_id = get_tenant_id());
CREATE TRIGGER tag_templates_updated_at BEFORE UPDATE ON public.stock_tag_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
