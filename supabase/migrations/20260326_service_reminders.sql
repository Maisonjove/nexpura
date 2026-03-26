-- Service Reminders table
-- Stores automated reminder configurations per tenant

CREATE TABLE IF NOT EXISTS public.service_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'event', -- 'annual', 'recurring', 'event'
  trigger_type text NOT NULL DEFAULT 'event', -- 'birthday', 'anniversary', 'purchase_anniversary', 'layby_due', 'service_due'
  trigger_value text, -- e.g. '12m' for 12 months after purchase
  status text NOT NULL DEFAULT 'active', -- 'active', 'inactive'
  channel text NOT NULL DEFAULT 'email', -- 'email', 'sms', 'both'
  subject text,
  body text,
  days_before int,
  days_after int,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS service_reminders_tenant_id_idx ON public.service_reminders(tenant_id);

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.service_reminders;
CREATE POLICY "tenant_isolation" ON public.service_reminders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_service_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS service_reminders_updated_at ON public.service_reminders;
CREATE TRIGGER service_reminders_updated_at
  BEFORE UPDATE ON public.service_reminders
  FOR EACH ROW EXECUTE FUNCTION update_service_reminders_updated_at();
