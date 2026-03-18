-- Marketing Module Tables
-- Run this migration in Supabase SQL Editor

-- Email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_type text DEFAULT 'all' CHECK (recipient_type IN ('all', 'segment', 'tags', 'manual')),
  recipient_filter jsonb DEFAULT '{}',
  stats jsonb DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "bounced": 0}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Automation settings
CREATE TABLE IF NOT EXISTS marketing_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  automation_type text NOT NULL,
  enabled boolean DEFAULT false,
  settings jsonb DEFAULT '{}',
  template_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, automation_type)
);

-- Customer segments
CREATE TABLE IF NOT EXISTS customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  rules jsonb DEFAULT '{}',
  is_system boolean DEFAULT false,
  customer_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_type text,
  is_system boolean DEFAULT false,
  variables jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email sends log (individual send tracking)
CREATE TABLE IF NOT EXISTS email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  resend_id text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text
);

-- SMS sends log
CREATE TABLE IF NOT EXISTS sms_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  twilio_sid text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  error_message text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant ON email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketing_automations_tenant ON marketing_automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_tenant ON customer_segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_tenant ON email_sends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_sends_tenant ON sms_sends(tenant_id);

-- Enable RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_email_campaigns" ON email_campaigns
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_marketing_automations" ON marketing_automations
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_customer_segments" ON customer_segments
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_email_templates" ON email_templates
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_email_sends" ON email_sends
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_sms_sends" ON sms_sends
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Insert default system segments (will be created per-tenant via trigger or app logic)
-- These are templates that get copied to each tenant

-- Function to create default marketing data for new tenants
CREATE OR REPLACE FUNCTION create_default_marketing_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Default segments
  INSERT INTO customer_segments (tenant_id, name, description, rules, is_system) VALUES
    (NEW.id, 'VIP Customers', 'Top 10% by total spend', '{"type": "vip", "percentile": 10}', true),
    (NEW.id, 'New Customers', 'Joined in last 30 days', '{"type": "new", "days": 30}', true),
    (NEW.id, 'Lapsed Customers', 'No purchase in 6+ months', '{"type": "lapsed", "months": 6}', true),
    (NEW.id, 'Repair Customers', 'Has active or past repairs', '{"type": "repair"}', true),
    (NEW.id, 'High Value', 'Single purchase over $1000', '{"type": "high_value", "amount": 1000}', true);

  -- Default email templates
  INSERT INTO email_templates (tenant_id, name, subject, body, template_type, is_system, variables) VALUES
    (NEW.id, 'Birthday Wish', 'Happy Birthday, {{customer_name}}! 🎂', '<p>Dear {{customer_name}},</p><p>Wishing you a wonderful birthday from all of us at {{business_name}}!</p><p>As a special gift, enjoy {{discount_code}} on your next visit.</p><p>Warm regards,<br>{{business_name}}</p>', 'birthday', true, '["customer_name", "business_name", "discount_code"]'),
    (NEW.id, 'Anniversary', 'Happy Anniversary! 🎉', '<p>Dear {{customer_name}},</p><p>It''s been {{years}} year(s) since you became part of our family at {{business_name}}!</p><p>Thank you for your continued trust. We look forward to serving you for many more years.</p><p>Best regards,<br>{{business_name}}</p>', 'anniversary', true, '["customer_name", "business_name", "years"]'),
    (NEW.id, 'Thank You', 'Thank you for your purchase!', '<p>Dear {{customer_name}},</p><p>Thank you for your recent purchase from {{business_name}}!</p><p>We appreciate your business and hope you love your new {{item_description}}.</p><p>If you have any questions, please don''t hesitate to reach out.</p><p>Best regards,<br>{{business_name}}</p>', 'thankyou', true, '["customer_name", "business_name", "item_description"]'),
    (NEW.id, 'We Miss You', 'We miss you at {{business_name}}!', '<p>Dear {{customer_name}},</p><p>It''s been a while since we''ve seen you, and we miss you!</p><p>As a welcome back offer, enjoy {{discount_code}} on your next purchase.</p><p>We hope to see you soon!</p><p>Warm regards,<br>{{business_name}}</p>', 'reengagement', true, '["customer_name", "business_name", "discount_code"]'),
    (NEW.id, 'Sale Announcement', '🎉 Special Sale at {{business_name}}!', '<p>Dear {{customer_name}},</p><p>We''re excited to announce our {{sale_name}}!</p><p>{{sale_details}}</p><p>Don''t miss out on these amazing deals!</p><p>Best regards,<br>{{business_name}}</p>', 'sale', true, '["customer_name", "business_name", "sale_name", "sale_details"]'),
    (NEW.id, 'New Arrivals', 'New Arrivals at {{business_name}}!', '<p>Dear {{customer_name}},</p><p>We''re thrilled to share our latest arrivals with you!</p><p>{{new_items}}</p><p>Visit us to see them in person!</p><p>Best regards,<br>{{business_name}}</p>', 'new_arrivals', true, '["customer_name", "business_name", "new_items"]'),
    (NEW.id, 'Holiday Greetings', 'Season''s Greetings from {{business_name}}!', '<p>Dear {{customer_name}},</p><p>Wishing you joy, peace, and happiness this holiday season!</p><p>Thank you for being a valued customer of {{business_name}}. We look forward to serving you in the new year.</p><p>Warm wishes,<br>{{business_name}}</p>', 'holiday', true, '["customer_name", "business_name"]');

  -- Default automation settings (all disabled by default)
  INSERT INTO marketing_automations (tenant_id, automation_type, enabled, settings) VALUES
    (NEW.id, 'birthday', false, '{"days_before": 0, "include_discount": false}'),
    (NEW.id, 'anniversary', false, '{"days_before": 0}'),
    (NEW.id, 'repair_ready_reminder', false, '{"days_after": 3}'),
    (NEW.id, 'reengagement', false, '{"months_inactive": 6}'),
    (NEW.id, 'post_purchase', false, '{"request_review": true}'),
    (NEW.id, 'appointment_24h', false, '{}'),
    (NEW.id, 'appointment_1h', false, '{}'),
    (NEW.id, 'valentines', false, '{}'),
    (NEW.id, 'mothers_day', false, '{}'),
    (NEW.id, 'christmas', false, '{}');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new tenants (if not exists)
DROP TRIGGER IF EXISTS on_tenant_created_marketing ON tenants;
CREATE TRIGGER on_tenant_created_marketing
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_marketing_data();
