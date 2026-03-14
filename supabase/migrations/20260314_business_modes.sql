-- 20260314_business_modes.sql
-- Add business_mode to tenants and improve task assignment

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS business_mode TEXT DEFAULT 'full' CHECK (business_mode IN ('retail', 'workshop', 'bespoke', 'full'));

-- Add department to staff_tasks for better organization
ALTER TABLE public.staff_tasks ADD COLUMN IF NOT EXISTS department TEXT;

-- Task Templates table for reusable tasks
CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  department text,
  business_mode text, -- optional filtering by mode
  priority text DEFAULT 'medium',
  estimated_minutes integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_templates' AND policyname='task_templates_tenant') THEN
    CREATE POLICY "task_templates_tenant" ON public.task_templates USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;
