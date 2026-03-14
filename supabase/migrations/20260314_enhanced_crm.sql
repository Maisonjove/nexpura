-- Enhanced CRM Fields
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS wrist_size text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gold_preference text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS spouse_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS spouse_birthday date;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_source text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS communication_preference text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_tags text[];

-- Wish List and Jewellery Owned Tables
CREATE TABLE IF NOT EXISTS public.customer_wishlist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_jewellery_owned (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  description text,
  purchase_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_jewellery_owned ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_wishlist' AND policyname='customer_wishlist_tenant') THEN
    CREATE POLICY "customer_wishlist_tenant" ON public.customer_wishlist USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_jewellery_owned' AND policyname='customer_owned_tenant') THEN
    CREATE POLICY "customer_owned_tenant" ON public.customer_jewellery_owned USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;
