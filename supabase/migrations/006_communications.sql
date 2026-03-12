-- 006_communications.sql - Communications hub

CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email','sms','note')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft','sent','failed','delivered')),
  sent_by UUID REFERENCES public.users(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comms_tenant ON public.communications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comms_customer ON public.communications(customer_id);

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comms_select" ON public.communications FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "comms_insert" ON public.communications FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
