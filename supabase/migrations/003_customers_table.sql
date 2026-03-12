-- ============================================================
-- 003_customers_table.sql — Customers (per tenant)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  notes         TEXT,
  tags          TEXT[] DEFAULT '{}',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(tenant_id, email);

-- Updated at trigger
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Tenant members can view all customers
CREATE POLICY "customers_select_tenant"
  ON public.customers FOR SELECT
  USING (tenant_id = auth.tenant_id());

-- Tenant members can insert customers
CREATE POLICY "customers_insert_tenant"
  ON public.customers FOR INSERT
  WITH CHECK (tenant_id = auth.tenant_id());

-- Tenant members can update customers
CREATE POLICY "customers_update_tenant"
  ON public.customers FOR UPDATE
  USING (tenant_id = auth.tenant_id());

-- Owners/managers can delete customers
CREATE POLICY "customers_delete_manager"
  ON public.customers FOR DELETE
  USING (tenant_id = auth.tenant_id() AND auth.user_role() IN ('owner', 'manager'));
