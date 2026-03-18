-- Printer configurations for tenants
CREATE TABLE IF NOT EXISTS public.printer_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  printer_type text NOT NULL,  -- 'receipt', 'label', 'office'
  brand text,                  -- 'Epson', 'Zebra', 'Brother', etc.
  connection_type text DEFAULT 'browser',  -- 'browser', 'network', 'usb'
  ip_address text,
  port integer,
  paper_width text,            -- '80mm', '58mm' for receipt
  label_width_mm integer,
  label_height_mm integer,
  cut_enabled boolean DEFAULT true,
  paper_size text DEFAULT 'A4',
  barcode_position_h text DEFAULT 'left',
  barcode_position_v text DEFAULT 'bottom',
  label_alignment text DEFAULT 'center',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, printer_type)
);

ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_printer_configs_tenant ON public.printer_configs(tenant_id);

-- RLS policies for printer_configs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'printer_configs_select' AND tablename = 'printer_configs') THEN
    CREATE POLICY printer_configs_select ON public.printer_configs FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'printer_configs_insert' AND tablename = 'printer_configs') THEN
    CREATE POLICY printer_configs_insert ON public.printer_configs FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'printer_configs_update' AND tablename = 'printer_configs') THEN
    CREATE POLICY printer_configs_update ON public.printer_configs FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'printer_configs_delete' AND tablename = 'printer_configs') THEN
    CREATE POLICY printer_configs_delete ON public.printer_configs FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;
