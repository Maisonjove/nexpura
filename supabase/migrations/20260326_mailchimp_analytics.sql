-- Mailchimp Campaign Analytics table for historical tracking
CREATE TABLE IF NOT EXISTS public.mailchimp_campaign_analytics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mailchimp_campaign_id text NOT NULL,
  title text,
  subject text,
  sent_at timestamptz,
  emails_sent integer DEFAULT 0,
  opens integer DEFAULT 0,
  unique_opens integer DEFAULT 0,
  open_rate numeric(5,4) DEFAULT 0,
  clicks integer DEFAULT 0,
  subscriber_clicks integer DEFAULT 0,
  click_rate numeric(5,4) DEFAULT 0,
  unsubscribes integer DEFAULT 0,
  bounce_rate numeric(5,4) DEFAULT 0,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, mailchimp_campaign_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mailchimp_analytics_tenant ON public.mailchimp_campaign_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mailchimp_analytics_sent ON public.mailchimp_campaign_analytics(sent_at);

-- RLS
ALTER TABLE public.mailchimp_campaign_analytics ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mailchimp_campaign_analytics' AND policyname='mailchimp_analytics_select') THEN
    CREATE POLICY "mailchimp_analytics_select" ON public.mailchimp_campaign_analytics FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mailchimp_campaign_analytics' AND policyname='mailchimp_analytics_insert') THEN
    CREATE POLICY "mailchimp_analytics_insert" ON public.mailchimp_campaign_analytics FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mailchimp_campaign_analytics' AND policyname='mailchimp_analytics_update') THEN
    CREATE POLICY "mailchimp_analytics_update" ON public.mailchimp_campaign_analytics FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_mailchimp_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mailchimp_analytics_updated_at ON public.mailchimp_campaign_analytics;
CREATE TRIGGER mailchimp_analytics_updated_at
  BEFORE UPDATE ON public.mailchimp_campaign_analytics
  FOR EACH ROW EXECUTE FUNCTION update_mailchimp_analytics_updated_at();
