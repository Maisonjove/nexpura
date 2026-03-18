-- ============================================================
-- WHATSAPP MARKETING CAMPAIGNS WITH STRIPE PAYMENTS
-- ============================================================

-- Add WhatsApp campaign tracking table
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_payment', 'paid', 'sending', 'sent', 'failed', 'cancelled')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  recipient_type text DEFAULT 'all' CHECK (recipient_type IN ('all', 'segment', 'tags', 'manual')),
  recipient_filter jsonb DEFAULT '{}',
  recipient_count integer DEFAULT 0,
  amount_cents integer DEFAULT 0, -- Total cost in cents (AUD)
  price_per_message_cents integer DEFAULT 16, -- $0.16 AUD = 16 cents
  stats jsonb DEFAULT '{"sent": 0, "delivered": 0, "failed": 0}',
  scheduled_at timestamptz,
  paid_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Marketing purchases table to track all payments
CREATE TABLE IF NOT EXISTS public.marketing_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES whatsapp_campaigns(id) ON DELETE SET NULL,
  campaign_type text DEFAULT 'whatsapp' CHECK (campaign_type IN ('whatsapp', 'sms', 'email')),
  stripe_session_id text NOT NULL,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL,
  message_count integer NOT NULL,
  price_per_message_cents integer NOT NULL,
  currency text DEFAULT 'aud',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- WhatsApp message sends log (individual message tracking)
CREATE TABLE IF NOT EXISTS public.whatsapp_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES whatsapp_campaigns(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  message_type text DEFAULT 'marketing' CHECK (message_type IN ('marketing', 'notification', 'task_assignment', 'job_ready')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  twilio_sid text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_tenant ON whatsapp_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON whatsapp_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_stripe ON whatsapp_campaigns(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_marketing_purchases_tenant ON marketing_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_purchases_session ON marketing_purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_tenant ON whatsapp_sends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_campaign ON whatsapp_sends(campaign_id);

-- Enable RLS
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_whatsapp_campaigns" ON whatsapp_campaigns
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_marketing_purchases" ON marketing_purchases
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_whatsapp_sends" ON whatsapp_sends
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
