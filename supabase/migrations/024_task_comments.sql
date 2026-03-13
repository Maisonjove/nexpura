-- 024_task_comments.sql
-- Task comments and attachment support

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_tenant ON public.task_comments(tenant_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_comments' AND policyname='tc_select') THEN
    CREATE POLICY "tc_select" ON public.task_comments FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_comments' AND policyname='tc_insert') THEN
    CREATE POLICY "tc_insert" ON public.task_comments FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_comments' AND policyname='tc_delete') THEN
    CREATE POLICY "tc_delete" ON public.task_comments FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Add attachment_urls to staff_tasks
ALTER TABLE public.staff_tasks ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]';
