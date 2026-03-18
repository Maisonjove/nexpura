-- Integrations table for third-party service connections
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, type)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON public.integrations(tenant_id);

-- RLS policies for integrations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'integrations_select' AND tablename = 'integrations') THEN
    CREATE POLICY integrations_select ON public.integrations FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'integrations_insert' AND tablename = 'integrations') THEN
    CREATE POLICY integrations_insert ON public.integrations FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'integrations_update' AND tablename = 'integrations') THEN
    CREATE POLICY integrations_update ON public.integrations FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'integrations_delete' AND tablename = 'integrations') THEN
    CREATE POLICY integrations_delete ON public.integrations FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Add phone number and WhatsApp notifications to team_members
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled boolean DEFAULT false;

-- Add notification_settings to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{}'::jsonb;
