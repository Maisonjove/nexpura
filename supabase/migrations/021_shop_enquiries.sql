-- 021_shop_enquiries.sql
-- Shop enquiries from the public storefront

CREATE TABLE IF NOT EXISTS public.shop_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enquiry_type TEXT NOT NULL, -- 'general' | 'repair' | 'appointment'
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  appointment_type TEXT,
  item_description TEXT,
  issue_description TEXT,
  status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'booked' | 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_enquiries_tenant ON public.shop_enquiries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shop_enquiries_status ON public.shop_enquiries(tenant_id, status);

ALTER TABLE public.shop_enquiries ENABLE ROW LEVEL SECURITY;

-- Tenant staff can read their enquiries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shop_enquiries' AND policyname='se_select') THEN
    CREATE POLICY "se_select" ON public.shop_enquiries FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shop_enquiries' AND policyname='se_update') THEN
    CREATE POLICY "se_update" ON public.shop_enquiries FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  -- Allow public inserts (for shop form submissions)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shop_enquiries' AND policyname='se_insert_public') THEN
    CREATE POLICY "se_insert_public" ON public.shop_enquiries FOR INSERT WITH CHECK (true);
  END IF;
END $$;
