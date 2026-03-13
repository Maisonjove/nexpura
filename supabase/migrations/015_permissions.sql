-- 015_permissions.sql
-- Permission system + extended roles + team member columns

-- Update team_members role check to include all roles
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner','manager','salesperson','workshop_jeweller','repair_technician','inventory_manager','accountant','staff','technician'));

-- Add department and last_login_at to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Role permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON public.role_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(tenant_id, role);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_permissions' AND policyname='rp_select') THEN
    CREATE POLICY "rp_select" ON public.role_permissions FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_permissions' AND policyname='rp_insert') THEN
    CREATE POLICY "rp_insert" ON public.role_permissions FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_permissions' AND policyname='rp_update') THEN
    CREATE POLICY "rp_update" ON public.role_permissions FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_permissions' AND policyname='rp_delete') THEN
    CREATE POLICY "rp_delete" ON public.role_permissions FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;
