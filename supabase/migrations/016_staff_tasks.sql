-- 016_staff_tasks.sql
-- Staff tasks system and activity logging

CREATE TABLE IF NOT EXISTS public.staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  linked_type TEXT, -- 'repair' | 'bespoke' | 'inventory' | 'supplier' | null
  linked_id UUID,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'urgent'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_tenant ON public.staff_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON public.staff_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_due ON public.staff_tasks(due_date);

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_tasks' AND policyname='st_select') THEN
    CREATE POLICY "st_select" ON public.staff_tasks FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_tasks' AND policyname='st_insert') THEN
    CREATE POLICY "st_insert" ON public.staff_tasks FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_tasks' AND policyname='st_update') THEN
    CREATE POLICY "st_update" ON public.staff_tasks FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_tasks' AND policyname='st_delete') THEN
    CREATE POLICY "st_delete" ON public.staff_tasks FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER staff_tasks_updated_at
  BEFORE UPDATE ON public.staff_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activity logs
CREATE TABLE IF NOT EXISTS public.staff_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_label TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sal_tenant ON public.staff_activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sal_user ON public.staff_activity_logs(user_id);

ALTER TABLE public.staff_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_activity_logs' AND policyname='sal_select') THEN
    CREATE POLICY "sal_select" ON public.staff_activity_logs FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_activity_logs' AND policyname='sal_insert') THEN
    CREATE POLICY "sal_insert" ON public.staff_activity_logs FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;
