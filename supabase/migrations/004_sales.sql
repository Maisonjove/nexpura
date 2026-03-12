-- 004_sales.sql - Sales / POS module

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'quote' CHECK (status IN ('quote','confirmed','paid','completed','refunded','layby')),
  payment_method TEXT CHECK (payment_method IN ('cash','card','transfer','layby','account','mixed')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  sold_by UUID REFERENCES public.users(id),
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  inventory_id UUID,
  description TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_select" ON public.sales FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "sales_insert" ON public.sales FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "sales_update" ON public.sales FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "sales_delete" ON public.sales FOR DELETE USING (tenant_id = get_tenant_id());

CREATE POLICY "sale_items_select" ON public.sale_items FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "sale_items_insert" ON public.sale_items FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "sale_items_update" ON public.sale_items FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "sale_items_delete" ON public.sale_items FOR DELETE USING (tenant_id = get_tenant_id());

CREATE TRIGGER sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
