-- 017_inventory_depth.sql
-- Advanced inventory fields

-- Certificate fields
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS certificate_number TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS grading_lab TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS report_url TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS cert_image_url TEXT;

-- Multi-stone support
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS secondary_stones JSONB;

-- Metal stock fields
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS metal_form TEXT;

-- Stock location
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS stock_location TEXT DEFAULT 'display';

-- Consignment fields
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignor_name TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignor_contact TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_start_date DATE;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_end_date DATE;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_commission_pct NUMERIC;

-- Linked supplier invoice
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS supplier_invoice_ref TEXT;

-- Stock movement log (physical location tracking)
CREATE TABLE IF NOT EXISTS public.inventory_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  moved_by UUID REFERENCES auth.users(id),
  from_location TEXT,
  to_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ism_tenant ON public.inventory_stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ism_item ON public.inventory_stock_movements(inventory_item_id);

ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_stock_movements' AND policyname='ism_select') THEN
    CREATE POLICY "ism_select" ON public.inventory_stock_movements FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_stock_movements' AND policyname='ism_insert') THEN
    CREATE POLICY "ism_insert" ON public.inventory_stock_movements FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;
