-- 013_missing_tables.sql
-- Create get_tenant_id() helper (alias for auth.tenant_id())
-- Create missing core tables: inventory, repairs, bespoke_jobs, passports, ai_conversations
-- Create purchase_orders, team_members, tasks

-- ============================================================
-- HELPER: get_tenant_id (used in older migrations)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  description text,
  category text,
  metal text,
  metal_colour text,
  metal_purity text,
  stone text,
  stone_colour text,
  carat numeric(10,3),
  weight_grams numeric(10,3),
  cost_price numeric(12,2),
  retail_price numeric(12,2),
  quantity integer DEFAULT 0,
  status text DEFAULT 'in_stock',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  location text,
  images text[],
  tags text[],
  custom_fields jsonb DEFAULT '{}',
  barcode_value text,
  is_published boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_sku ON public.inventory(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON public.inventory(tenant_id);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory' AND policyname='inventory_select') THEN
    CREATE POLICY "inventory_select" ON public.inventory FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory' AND policyname='inventory_insert') THEN
    CREATE POLICY "inventory_insert" ON public.inventory FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory' AND policyname='inventory_update') THEN
    CREATE POLICY "inventory_update" ON public.inventory FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory' AND policyname='inventory_delete') THEN
    CREATE POLICY "inventory_delete" ON public.inventory FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- REPAIRS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.repairs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_number text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  item_type text,
  item_description text NOT NULL,
  item_images text[],
  metal_type text,
  brand text,
  condition_notes text,
  repair_type text,
  work_description text,
  work_required text,
  technician text,
  priority text DEFAULT 'normal',
  status text DEFAULT 'intake',
  quoted_price numeric(12,2),
  final_price numeric(12,2),
  estimated_cost numeric(12,2),
  final_cost numeric(12,2),
  deposit_amount numeric(12,2),
  deposit_paid boolean DEFAULT false,
  due_date date,
  completed_at timestamptz,
  internal_notes text,
  client_notes text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repairs_tenant ON public.repairs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repairs_customer ON public.repairs(customer_id);

ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repairs' AND policyname='repairs_select') THEN
    CREATE POLICY "repairs_select" ON public.repairs FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repairs' AND policyname='repairs_insert') THEN
    CREATE POLICY "repairs_insert" ON public.repairs FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repairs' AND policyname='repairs_update') THEN
    CREATE POLICY "repairs_update" ON public.repairs FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repairs' AND policyname='repairs_delete') THEN
    CREATE POLICY "repairs_delete" ON public.repairs FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER repairs_updated_at
  BEFORE UPDATE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- BESPOKE JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bespoke_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_number text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  title text NOT NULL,
  description text,
  order_type text DEFAULT 'bespoke',
  jewellery_type text,
  stage text DEFAULT 'enquiry',
  priority text DEFAULT 'normal',
  metal text,
  metal_type text,
  metal_colour text,
  metal_purity text,
  metal_weight_grams numeric(10,3),
  stone text,
  stone_type text,
  stone_colour text,
  stone_carat numeric(10,3),
  design_notes text,
  client_notes text,
  internal_notes text,
  images text[],
  estimated_cost numeric(12,2),
  final_cost numeric(12,2),
  deposit_paid numeric(12,2),
  deposit_amount numeric(12,2),
  deposit_received boolean DEFAULT false,
  due_date date,
  completed_at timestamptz,
  deleted_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bespoke_tenant ON public.bespoke_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_customer ON public.bespoke_jobs(customer_id);

ALTER TABLE public.bespoke_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_jobs' AND policyname='bespoke_select') THEN
    CREATE POLICY "bespoke_select" ON public.bespoke_jobs FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_jobs' AND policyname='bespoke_insert') THEN
    CREATE POLICY "bespoke_insert" ON public.bespoke_jobs FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_jobs' AND policyname='bespoke_update') THEN
    CREATE POLICY "bespoke_update" ON public.bespoke_jobs FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bespoke_jobs' AND policyname='bespoke_delete') THEN
    CREATE POLICY "bespoke_delete" ON public.bespoke_jobs FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER bespoke_updated_at
  BEFORE UPDATE ON public.bespoke_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PASSPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.passports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  passport_number text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  description text,
  metal text,
  stone text,
  carat numeric(10,3),
  weight_grams numeric(10,3),
  purchase_date date,
  purchase_price numeric(12,2),
  images text[],
  certificate_url text,
  qr_code_url text,
  is_public boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passports_tenant ON public.passports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_passports_customer ON public.passports(customer_id);

ALTER TABLE public.passports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='passports' AND policyname='passports_select') THEN
    CREATE POLICY "passports_select" ON public.passports FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='passports' AND policyname='passports_insert') THEN
    CREATE POLICY "passports_insert" ON public.passports FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='passports' AND policyname='passports_update') THEN
    CREATE POLICY "passports_update" ON public.passports FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='passports' AND policyname='passports_delete') THEN
    CREATE POLICY "passports_delete" ON public.passports FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='passports' AND policyname='passports_public_view') THEN
    CREATE POLICY "passports_public_view" ON public.passports FOR SELECT USING (is_public = true);
  END IF;
END $$;

CREATE TRIGGER passports_updated_at
  BEFORE UPDATE ON public.passports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_convos_tenant ON public.ai_conversations(tenant_id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='ai_convos_select') THEN
    CREATE POLICY "ai_convos_select" ON public.ai_conversations FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='ai_convos_insert') THEN
    CREATE POLICY "ai_convos_insert" ON public.ai_conversations FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='ai_convos_update') THEN
    CREATE POLICY "ai_convos_update" ON public.ai_conversations FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER ai_convos_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- INVOICES (extended schema if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  repair_id uuid REFERENCES public.repairs(id) ON DELETE SET NULL,
  bespoke_job_id uuid REFERENCES public.bespoke_jobs(id) ON DELETE SET NULL,
  reference_type text,
  reference_id uuid,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  line_items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  tax_name text DEFAULT 'GST',
  tax_rate numeric(5,4) DEFAULT 0.1,
  tax_inclusive boolean DEFAULT true,
  tax_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  status text DEFAULT 'draft',
  paid_at timestamptz,
  notes text,
  footer_text text,
  stripe_payment_intent_id text,
  stripe_payment_link text,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON public.invoices(sale_id);

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  discount_pct numeric(5,2) DEFAULT 0,
  line_total numeric(12,2) NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_line_items(invoice_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_select') THEN
    CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_insert') THEN
    CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_update') THEN
    CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_delete') THEN
    CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_line_items' AND policyname='invoice_items_select') THEN
    CREATE POLICY "invoice_items_select" ON public.invoice_line_items FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_line_items' AND policyname='invoice_items_insert') THEN
    CREATE POLICY "invoice_items_insert" ON public.invoice_line_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_line_items' AND policyname='invoice_items_update') THEN
    CREATE POLICY "invoice_items_update" ON public.invoice_line_items FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_line_items' AND policyname='invoice_items_delete') THEN
    CREATE POLICY "invoice_items_delete" ON public.invoice_line_items FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Next invoice number RPC
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_number text;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.invoices WHERE tenant_id = p_tenant_id;
  v_number := 'INV-' || LPAD(v_count::text, 4, '0');
  RETURN v_number;
END;
$$;

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number text UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  status text DEFAULT 'ordered' CHECK (status IN ('draft','ordered','partial','received','cancelled')),
  expected_date date,
  received_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='po_select') THEN
    CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='po_insert') THEN
    CREATE POLICY "po_insert" ON public.purchase_orders FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='po_update') THEN
    CREATE POLICY "po_update" ON public.purchase_orders FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='po_delete') THEN
    CREATE POLICY "po_delete" ON public.purchase_orders FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff','technician')),
  name text NOT NULL,
  email text NOT NULL,
  permissions jsonb DEFAULT '{}',
  invite_token text,
  invite_accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON public.team_members(tenant_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_members' AND policyname='team_select') THEN
    CREATE POLICY "team_select" ON public.team_members FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_members' AND policyname='team_insert') THEN
    CREATE POLICY "team_insert" ON public.team_members FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_members' AND policyname='team_update') THEN
    CREATE POLICY "team_update" ON public.team_members FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_members' AND policyname='team_delete') THEN
    CREATE POLICY "team_delete" ON public.team_members FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date date,
  completed_at timestamptz,
  related_type text,
  related_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_select') THEN
    CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_insert') THEN
    CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_update') THEN
    CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_delete') THEN
    CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
