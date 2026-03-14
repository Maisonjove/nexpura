-- ============================================================
-- CRITICAL SYSTEMS: Stocktakes, Memo/Consignment, Appraisals
-- Print Queue, Website Modes, Task Enhancements
-- ============================================================

-- ── STOCKTAKES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stocktakes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference_number text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled')),
  notes text,
  location text,
  started_at timestamptz,
  completed_at timestamptz,
  total_items_counted integer DEFAULT 0,
  total_discrepancies integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocktakes_tenant ON public.stocktakes(tenant_id);
ALTER TABLE public.stocktakes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stocktakes' AND policyname='stocktakes_tenant') THEN
    CREATE POLICY "stocktakes_tenant" ON public.stocktakes USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER stocktakes_updated_at
  BEFORE UPDATE ON public.stocktakes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stocktake_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id uuid NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  sku text,
  item_name text NOT NULL,
  expected_qty integer DEFAULT 0,
  counted_qty integer,
  discrepancy integer GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
  barcode_value text,
  notes text,
  counted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  counted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocktake_items_stocktake ON public.stocktake_items(stocktake_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_tenant ON public.stocktake_items(tenant_id);
ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stocktake_items' AND policyname='stocktake_items_tenant') THEN
    CREATE POLICY "stocktake_items_tenant" ON public.stocktake_items USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ── MEMO / CONSIGNMENT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memo_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  memo_number text,
  memo_type text NOT NULL DEFAULT 'memo' CHECK (memo_type IN ('memo','consignment')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','sold','expired','lost')),
  -- Supplier / customer who sent it (for consignment in)
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  -- Customer taking it on memo (memo out)
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  -- Item details
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  item_description text,
  sku text,
  metal text,
  stone text,
  weight_grams numeric(10,3),
  images text[],
  -- Values
  wholesale_value numeric(12,2),
  retail_value numeric(12,2),
  agreed_price numeric(12,2),
  commission_rate numeric(5,2),
  -- Dates
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  due_back_date date,
  returned_date date,
  sold_date date,
  -- Linked records
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes text,
  terms text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memo_items_tenant ON public.memo_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memo_items_customer ON public.memo_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_memo_items_supplier ON public.memo_items(supplier_id);
ALTER TABLE public.memo_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memo_items' AND policyname='memo_items_tenant') THEN
    CREATE POLICY "memo_items_tenant" ON public.memo_items USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER memo_items_updated_at
  BEFORE UPDATE ON public.memo_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── APPRAISALS / VALUATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appraisals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appraisal_number text,
  appraisal_type text NOT NULL DEFAULT 'insurance' CHECK (appraisal_type IN ('insurance','estate','retail','wholesale','damage','other')),
  purpose text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','issued')),
  -- Client
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_address text,
  -- Item details
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  item_description text,
  metal text,
  metal_purity text,
  metal_weight_grams numeric(10,3),
  stone text,
  stone_carat numeric(10,3),
  stone_colour text,
  stone_clarity text,
  stone_cut text,
  stone_certificate_number text,
  hallmarks text,
  maker_marks text,
  condition text DEFAULT 'good',
  age_period text,
  provenance text,
  images text[],
  -- Values
  appraised_value numeric(12,2),
  replacement_value numeric(12,2),
  insurance_value numeric(12,2),
  market_value numeric(12,2),
  -- Appraiser
  appraiser_name text,
  appraiser_qualifications text,
  appraiser_licence text,
  -- Dates
  appraisal_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  issued_at timestamptz,
  -- Extras
  methodology text,
  references_used text,
  notes text,
  pdf_url text,
  fee numeric(12,2),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appraisals_tenant ON public.appraisals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_customer ON public.appraisals(customer_id);
ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appraisals' AND policyname='appraisals_tenant') THEN
    CREATE POLICY "appraisals_tenant" ON public.appraisals USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER appraisals_updated_at
  BEFORE UPDATE ON public.appraisals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── PRINT QUEUE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- 'invoice','repair_ticket','bespoke_sheet','stock_tag','appraisal','memo','receipt'
  document_id uuid,
  document_title text,
  printer_type text NOT NULL DEFAULT 'office', -- 'receipt','label','office'
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printing','done','failed','cancelled')),
  copies integer DEFAULT 1,
  pdf_url text,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  printed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_tenant ON public.print_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_jobs' AND policyname='print_jobs_tenant') THEN
    CREATE POLICY "print_jobs_tenant" ON public.print_jobs USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ── TASK ENHANCEMENTS ─────────────────────────────────────────
ALTER TABLE public.staff_tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_minutes integer,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS watchers uuid[] DEFAULT '{}';

-- ── WEBSITE MODES (extend website_config) ────────────────────
ALTER TABLE public.website_config
  ADD COLUMN IF NOT EXISTS mode_label text,
  ADD COLUMN IF NOT EXISTS catalogue_show_sku boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS catalogue_show_weight boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS catalogue_show_metal boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalogue_show_stone boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalogue_grid_columns integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS catalogue_sort_by text DEFAULT 'created_at',
  ADD COLUMN IF NOT EXISTS enable_appointments boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_repairs_enquiry boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_whatsapp_chat boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS google_analytics_id text,
  ADD COLUMN IF NOT EXISTS facebook_pixel_id text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS announcement_bar text,
  ADD COLUMN IF NOT EXISTS announcement_bar_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_title text,
  ADD COLUMN IF NOT EXISTS popup_body text,
  ADD COLUMN IF NOT EXISTS trust_badges jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS custom_css text,
  ADD COLUMN IF NOT EXISTS header_links jsonb DEFAULT '[]';

-- ── SUPER ADMIN: Global Revenue Snapshots ─────────────────────
CREATE TABLE IF NOT EXISTS public.admin_revenue_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  mrr_aud numeric(12,2) DEFAULT 0,
  arr_aud numeric(12,2) DEFAULT 0,
  active_tenants integer DEFAULT 0,
  trialing_tenants integer DEFAULT 0,
  churned_tenants integer DEFAULT 0,
  new_tenants integer DEFAULT 0,
  plan_breakdown jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_snapshots_date ON public.admin_revenue_snapshots(snapshot_date);

-- ── NUMBERING SEQUENCES (extend if needed) ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='numbering_sequences' AND column_name='stocktake_next') THEN
    ALTER TABLE public.numbering_sequences ADD COLUMN stocktake_next integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='numbering_sequences' AND column_name='memo_next') THEN
    ALTER TABLE public.numbering_sequences ADD COLUMN memo_next integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='numbering_sequences' AND column_name='appraisal_next') THEN
    ALTER TABLE public.numbering_sequences ADD COLUMN appraisal_next integer DEFAULT 1;
  END IF;
END $$;
