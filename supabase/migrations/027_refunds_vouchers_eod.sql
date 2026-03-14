-- 027_refunds_vouchers_eod.sql
-- Gift vouchers, refund records, EOD reconciliation, layby payments

-- ============================================================
-- GIFT VOUCHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gift_vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  original_amount NUMERIC(10,2) NOT NULL,
  balance NUMERIC(10,2) NOT NULL,
  issued_to_name TEXT,
  issued_to_email TEXT,
  issued_by UUID REFERENCES public.users(id),
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','expired','voided')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_vouchers_code ON public.gift_vouchers(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_gift_vouchers_tenant ON public.gift_vouchers(tenant_id);

ALTER TABLE public.gift_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gift_vouchers_select" ON public.gift_vouchers FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "gift_vouchers_insert" ON public.gift_vouchers FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "gift_vouchers_update" ON public.gift_vouchers FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "gift_vouchers_delete" ON public.gift_vouchers FOR DELETE USING (tenant_id = public.get_tenant_id());

CREATE TRIGGER gift_vouchers_updated_at BEFORE UPDATE ON public.gift_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- GIFT VOUCHER REDEMPTIONS (audit trail of uses)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gift_voucher_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL REFERENCES public.gift_vouchers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  amount_used NUMERIC(10,2) NOT NULL,
  redeemed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gift_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gvr_select" ON public.gift_voucher_redemptions FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "gvr_insert" ON public.gift_voucher_redemptions FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- REFUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  refund_number TEXT NOT NULL,
  original_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  original_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  reason TEXT,
  refund_method TEXT CHECK (refund_method IN ('cash','card','store_credit','voucher')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','voided')),
  notes TEXT,
  processed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refund_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  original_sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,
  restock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON public.refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_sale ON public.refunds(original_sale_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select" ON public.refunds FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "refunds_insert" ON public.refunds FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "refunds_update" ON public.refunds FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "refunds_delete" ON public.refunds FOR DELETE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "refund_items_select" ON public.refund_items FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "refund_items_insert" ON public.refund_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "refund_items_delete" ON public.refund_items FOR DELETE USING (tenant_id = public.get_tenant_id());

CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- LAYBY PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.layby_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','card','transfer')),
  notes TEXT,
  received_by UUID REFERENCES public.users(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layby_payments_sale ON public.layby_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_layby_payments_tenant ON public.layby_payments(tenant_id);

ALTER TABLE public.layby_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "layby_payments_select" ON public.layby_payments FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "layby_payments_insert" ON public.layby_payments FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "layby_payments_delete" ON public.layby_payments FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- END OF DAY RECONCILIATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.eod_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_sales_cash NUMERIC(10,2) DEFAULT 0,
  total_sales_card NUMERIC(10,2) DEFAULT 0,
  total_sales_transfer NUMERIC(10,2) DEFAULT 0,
  total_sales_voucher NUMERIC(10,2) DEFAULT 0,
  total_sales_layby NUMERIC(10,2) DEFAULT 0,
  total_sales_mixed NUMERIC(10,2) DEFAULT 0,
  total_refunds_cash NUMERIC(10,2) DEFAULT 0,
  total_refunds_card NUMERIC(10,2) DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  cash_expected NUMERIC(10,2) DEFAULT 0,
  cash_counted NUMERIC(10,2),
  cash_variance NUMERIC(10,2),
  opening_float NUMERIC(10,2) DEFAULT 0,
  closing_float NUMERIC(10,2),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_by UUID REFERENCES public.users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eod_tenant_date ON public.eod_reconciliations(tenant_id, reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_eod_tenant ON public.eod_reconciliations(tenant_id);

ALTER TABLE public.eod_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eod_select" ON public.eod_reconciliations FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "eod_insert" ON public.eod_reconciliations FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "eod_update" ON public.eod_reconciliations FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE TRIGGER eod_reconciliations_updated_at BEFORE UPDATE ON public.eod_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add voucher_amount column to sales if it doesn't exist (for voucher partial payments)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='voucher_amount') THEN
    ALTER TABLE public.sales ADD COLUMN voucher_amount NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add store_credit to customers for account balance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='store_credit') THEN
    ALTER TABLE public.customers ADD COLUMN store_credit NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;
