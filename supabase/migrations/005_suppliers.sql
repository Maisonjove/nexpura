-- 005_suppliers.sql - Supplier management

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (tenant_id = auth.tenant_id());
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (tenant_id = auth.tenant_id());

CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
