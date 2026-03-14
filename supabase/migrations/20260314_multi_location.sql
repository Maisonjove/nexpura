-- Multi-location Support
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'showroom' CHECK (type IN ('showroom', 'workshop', 'warehouse', 'office', 'other')),
  address_line1 text,
  suburb text,
  state text,
  postcode text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='locations_tenant') THEN
    CREATE POLICY "locations_tenant" ON public.locations USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Add location_id to inventory
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='location_id') THEN
    ALTER TABLE public.inventory ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Stock Transfers
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_transfers' AND policyname='stock_transfers_tenant') THEN
    CREATE POLICY "stock_transfers_tenant" ON public.stock_transfers USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_transfer_items' AND policyname='stock_transfer_items_tenant') THEN
    CREATE POLICY "stock_transfer_items_tenant" ON public.stock_transfer_items USING (SELECT tenant_id FROM public.stock_transfers WHERE id = transfer_id) = public.get_tenant_id();
  END IF;
END $$;
