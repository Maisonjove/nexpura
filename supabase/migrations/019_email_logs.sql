-- 019_email_logs.sql
-- Ensure email_logs table exists with required fields
-- (may already exist from email infrastructure)

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  template_type TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'sent',
  resend_message_id TEXT,
  linked_entity_type TEXT,
  linked_entity_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant ON public.email_logs(tenant_id);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_logs' AND policyname='el_select') THEN
    CREATE POLICY "el_select" ON public.email_logs FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_logs' AND policyname='el_insert') THEN
    CREATE POLICY "el_insert" ON public.email_logs FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Add missing columns to existing email_logs if they were created differently
-- These are safe to run even if the table already existed with different columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_logs' AND column_name='recipient_email') THEN
    ALTER TABLE public.email_logs ADD COLUMN recipient_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_logs' AND column_name='template_type') THEN
    ALTER TABLE public.email_logs ADD COLUMN template_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_logs' AND column_name='linked_entity_type') THEN
    ALTER TABLE public.email_logs ADD COLUMN linked_entity_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_logs' AND column_name='linked_entity_id') THEN
    ALTER TABLE public.email_logs ADD COLUMN linked_entity_id UUID;
  END IF;
END $$;
