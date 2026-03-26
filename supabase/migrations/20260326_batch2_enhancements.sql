-- Batch 2: Bespoke Milestones, Approval Workflow, Integrations, Invoice Enhancements

-- ============================================================
-- BESPOKE MILESTONES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bespoke_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bespoke_job_id UUID NOT NULL REFERENCES public.bespoke_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bespoke_milestones_tenant ON public.bespoke_milestones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_milestones_job ON public.bespoke_milestones(bespoke_job_id);

ALTER TABLE public.bespoke_milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_milestones' AND policyname='bespoke_milestones_select') THEN
    CREATE POLICY "bespoke_milestones_select" ON public.bespoke_milestones FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_milestones' AND policyname='bespoke_milestones_insert') THEN
    CREATE POLICY "bespoke_milestones_insert" ON public.bespoke_milestones FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_milestones' AND policyname='bespoke_milestones_update') THEN
    CREATE POLICY "bespoke_milestones_update" ON public.bespoke_milestones FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_milestones' AND policyname='bespoke_milestones_delete') THEN
    CREATE POLICY "bespoke_milestones_delete" ON public.bespoke_milestones FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ============================================================
-- BESPOKE APPROVAL WORKFLOW COLUMNS
-- ============================================================
ALTER TABLE public.bespoke_jobs
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_token UUID,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT;

CREATE INDEX IF NOT EXISTS idx_bespoke_approval_token ON public.bespoke_jobs(approval_token) WHERE approval_token IS NOT NULL;

-- ============================================================
-- INVOICE STRIPE PAYMENT LINK
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT,
  ADD COLUMN IF NOT EXISTS overdue_reminder_sent_at JSONB DEFAULT '{}';

-- ============================================================
-- INVENTORY INTEGRATION COLUMNS
-- ============================================================
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS woo_product_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inventory_shopify ON public.inventory(shopify_variant_id) WHERE shopify_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_woo ON public.inventory(woo_product_id) WHERE woo_product_id IS NOT NULL;

-- ============================================================
-- INTEGRATIONS TABLE ENHANCEMENTS
-- ============================================================
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- ============================================================
-- MAILCHIMP SYNC LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mailchimp_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT,
  mailchimp_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_mailchimp_sync_tenant ON public.mailchimp_sync_log(tenant_id);

-- ============================================================
-- REFUNDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  refund_number TEXT NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  refund_method TEXT NOT NULL,
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON public.refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_sale ON public.refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_refund ON public.refund_items(refund_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='refunds' AND policyname='refunds_select') THEN
    CREATE POLICY "refunds_select" ON public.refunds FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='refunds' AND policyname='refunds_insert') THEN
    CREATE POLICY "refunds_insert" ON public.refunds FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='refund_items' AND policyname='refund_items_select') THEN
    CREATE POLICY "refund_items_select" ON public.refund_items FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='refund_items' AND policyname='refund_items_insert') THEN
    CREATE POLICY "refund_items_insert" ON public.refund_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ============================================================
-- NEXT_REFUND_NUMBER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_refund_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT := 'R';
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN refund_number ~ '^R-[0-9]+$' THEN CAST(SUBSTRING(refund_number FROM 3) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO v_seq
  FROM public.refunds
  WHERE tenant_id = p_tenant_id;

  v_result := v_prefix || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_result;
END;
$$;

-- ============================================================
-- TENANT SETTINGS FOR OVERDUE REMINDERS
-- ============================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS overdue_reminders_enabled BOOLEAN DEFAULT true;
