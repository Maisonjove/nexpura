-- 014_additions.sql
-- Create get_tenant_id() helper function
-- Create purchase_orders, team_members, tasks tables
-- (inventory, repairs, bespoke_jobs, passports etc already exist)

-- ============================================================
-- HELPER: get_tenant_id (used in existing migrations)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- NEXT INVOICE NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_number text;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
  INTO v_count
  FROM public.invoices
  WHERE tenant_id = p_tenant_id;
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

DROP TRIGGER IF EXISTS purchase_orders_updated_at ON public.purchase_orders;
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

DROP TRIGGER IF EXISTS team_members_updated_at ON public.team_members;
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

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
