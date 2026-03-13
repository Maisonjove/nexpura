-- 020_printer_configs.sql
-- Printer configuration per tenant

CREATE TABLE IF NOT EXISTS public.printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  printer_type TEXT NOT NULL, -- 'receipt' | 'label' | 'office'
  printer_name TEXT,
  brand TEXT,
  connection_type TEXT DEFAULT 'browser', -- 'browser' | 'network'
  ip_address TEXT,
  port INTEGER,
  paper_width TEXT DEFAULT '80mm',
  label_width_mm INTEGER,
  label_height_mm INTEGER,
  cut_enabled BOOLEAN DEFAULT true,
  paper_size TEXT DEFAULT 'A4', -- for office printer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, printer_type)
);

CREATE INDEX IF NOT EXISTS idx_printer_configs_tenant ON public.printer_configs(tenant_id);

ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='printer_configs' AND policyname='pc_select') THEN
    CREATE POLICY "pc_select" ON public.printer_configs FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='printer_configs' AND policyname='pc_insert') THEN
    CREATE POLICY "pc_insert" ON public.printer_configs FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='printer_configs' AND policyname='pc_update') THEN
    CREATE POLICY "pc_update" ON public.printer_configs FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='printer_configs' AND policyname='pc_delete') THEN
    CREATE POLICY "pc_delete" ON public.printer_configs FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER printer_configs_updated_at
  BEFORE UPDATE ON public.printer_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
