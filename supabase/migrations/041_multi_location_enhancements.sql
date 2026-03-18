-- Multi-Location Enhancements
-- Stock transfers workflow (pending → in_transit → completed)
-- Location-specific settings
-- Team member location junction table

-- Enhance stock_transfers with dispatch/receive workflow
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_transfers' AND column_name='dispatched_at') THEN
    ALTER TABLE public.stock_transfers ADD COLUMN dispatched_at timestamptz;
    ALTER TABLE public.stock_transfers ADD COLUMN dispatched_by uuid REFERENCES auth.users(id);
    ALTER TABLE public.stock_transfers ADD COLUMN received_at timestamptz;
    ALTER TABLE public.stock_transfers ADD COLUMN received_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add 'in_transit' status option
DO $$ BEGIN
  ALTER TABLE public.stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_status_check;
  ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_status_check 
    CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add received_quantity to stock_transfer_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_transfer_items' AND column_name='received_quantity') THEN
    ALTER TABLE public.stock_transfer_items ADD COLUMN received_quantity integer;
  END IF;
END $$;

-- Location settings (operating hours, tax, etc.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='operating_hours') THEN
    ALTER TABLE public.locations ADD COLUMN operating_hours jsonb DEFAULT '{}';
    ALTER TABLE public.locations ADD COLUMN default_tax_rate decimal(5,2);
    ALTER TABLE public.locations ADD COLUMN receipt_footer text;
    ALTER TABLE public.locations ADD COLUMN phone text;
    ALTER TABLE public.locations ADD COLUMN email text;
  END IF;
END $$;

-- Add location_id to relevant tables if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='location_id') THEN
    ALTER TABLE public.sales ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='repairs' AND column_name='location_id') THEN
    ALTER TABLE public.repairs ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bespoke_jobs' AND column_name='location_id') THEN
    ALTER TABLE public.bespoke_jobs ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='location_id') THEN
    ALTER TABLE public.invoices ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='location_id') THEN
    ALTER TABLE public.expenses ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Team member locations junction table (alternative to array approach)
CREATE TABLE IF NOT EXISTS public.team_member_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_member_id, location_id)
);

ALTER TABLE public.team_member_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_member_locations' AND policyname='team_member_locations_tenant') THEN
    CREATE POLICY "team_member_locations_tenant" ON public.team_member_locations 
    USING (
      EXISTS (
        SELECT 1 FROM public.team_members tm 
        WHERE tm.id = team_member_id AND tm.tenant_id = public.get_tenant_id()
      )
    );
  END IF;
END $$;

-- Inter-location messages/notes
CREATE TABLE IF NOT EXISTS public.location_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  message text NOT NULL,
  message_type text DEFAULT 'note' CHECK (message_type IN ('note', 'transfer_request', 'alert', 'announcement')),
  is_read boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.location_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='location_messages' AND policyname='location_messages_tenant') THEN
    CREATE POLICY "location_messages_tenant" ON public.location_messages 
    USING (tenant_id = public.get_tenant_id()) 
    WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_locations ON public.stock_transfers(from_location_id, to_location_id);
CREATE INDEX IF NOT EXISTS idx_sales_location ON public.sales(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_location ON public.repairs(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_location ON public.inventory(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_location_messages_to ON public.location_messages(to_location_id, is_read);
