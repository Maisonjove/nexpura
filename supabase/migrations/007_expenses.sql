-- 007_expenses.sql - Expense tracking

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('stock','rent','utilities','marketing','staffing','equipment','repairs','other')),
  amount NUMERIC(10,2) NOT NULL,
  invoice_ref TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON public.expenses(tenant_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE USING (tenant_id = auth.tenant_id());
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (tenant_id = auth.tenant_id());

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
