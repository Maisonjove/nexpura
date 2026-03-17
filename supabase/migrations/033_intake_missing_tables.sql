-- 033_intake_missing_tables.sql
-- Add all missing tables and columns required by intake/actions.ts

-- ============================================================
-- PAYMENTS TABLE (for recording deposits/payments against invoices)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_method text CHECK (payment_method IN ('cash','card','transfer','cheque','paypal','afterpay','zippay','account','other')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments_select') THEN
    CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments_insert') THEN
    CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments_update') THEN
    CREATE POLICY "payments_update" ON public.payments FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments_delete') THEN
    CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STOCK MOVEMENTS TABLE (for tracking inventory quantity changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('sale','return','adjustment','stocktake','purchase','transfer','write_off','other')),
  quantity_change integer NOT NULL,
  quantity_after integer,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory ON public.stock_movements(inventory_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='stock_movements_select') THEN
    CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='stock_movements_insert') THEN
    CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='stock_movements_update') THEN
    CREATE POLICY "stock_movements_update" ON public.stock_movements FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ============================================================
-- REPAIR STAGES TABLE (for tracking repair stage history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.repair_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_stages_tenant ON public.repair_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repair_stages_repair ON public.repair_stages(repair_id);

ALTER TABLE public.repair_stages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repair_stages' AND policyname='repair_stages_select') THEN
    CREATE POLICY "repair_stages_select" ON public.repair_stages FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repair_stages' AND policyname='repair_stages_insert') THEN
    CREATE POLICY "repair_stages_insert" ON public.repair_stages FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ============================================================
-- BESPOKE JOB STAGES TABLE (for tracking bespoke job stage history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bespoke_job_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.bespoke_jobs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bespoke_job_stages_tenant ON public.bespoke_job_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_job_stages_job ON public.bespoke_job_stages(job_id);

ALTER TABLE public.bespoke_job_stages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_job_stages' AND policyname='bespoke_job_stages_select') THEN
    CREATE POLICY "bespoke_job_stages_select" ON public.bespoke_job_stages FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_job_stages' AND policyname='bespoke_job_stages_insert') THEN
    CREATE POLICY "bespoke_job_stages_insert" ON public.bespoke_job_stages FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ============================================================
-- ADD MISSING COLUMNS TO REPAIRS
-- ============================================================
ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS repair_number text;

-- Create index on repair_number for the next_repair_number function
CREATE INDEX IF NOT EXISTS idx_repairs_repair_number ON public.repairs(tenant_id, repair_number);

-- ============================================================
-- INVOICE LINE ITEMS - add line_total if missing (some inserts use it)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_line_items' AND column_name='line_total') THEN
    ALTER TABLE public.invoice_line_items ADD COLUMN line_total numeric(12,2);
  END IF;
END $$;
