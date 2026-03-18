-- Custom email domains for tenants
-- Each jeweller can set up their own domain for sending emails

CREATE TABLE IF NOT EXISTS public.email_domains (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  resend_domain_id text, -- ID from Resend API
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'verified', 'failed')),
  dns_records jsonb, -- Store the DNS records to show user
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id), -- One domain per tenant
  UNIQUE(domain) -- Each domain can only be used once
);

ALTER TABLE public.email_domains ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_domains_select' AND tablename = 'email_domains') THEN
    CREATE POLICY email_domains_select ON public.email_domains FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_domains_insert' AND tablename = 'email_domains') THEN
    CREATE POLICY email_domains_insert ON public.email_domains FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_domains_update' AND tablename = 'email_domains') THEN
    CREATE POLICY email_domains_update ON public.email_domains FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_domains_delete' AND tablename = 'email_domains') THEN
    CREATE POLICY email_domains_delete ON public.email_domains FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Add email_from_name to tenants for custom sender name
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='email_from_name') THEN
    ALTER TABLE public.tenants ADD COLUMN email_from_name text;
  END IF;
END $$;

-- Add reply_to_email to tenants for businesses without custom domain
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='reply_to_email') THEN
    ALTER TABLE public.tenants ADD COLUMN reply_to_email text;
  END IF;
END $$;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_domains_tenant ON public.email_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_domains_status ON public.email_domains(status);
