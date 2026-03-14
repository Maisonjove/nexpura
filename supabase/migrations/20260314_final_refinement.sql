-- 20260314_final_refinement.sql
-- Final refinement pass: Store Credit, Marketing Automation, Task Timelines, Audit Logs

-- ── CUSTOMER STORE CREDIT HISTORY ────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_store_credit_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL, -- positive for credit, negative for debit
  balance_after numeric(12,2) NOT NULL,
  reason text NOT NULL, -- 'refund', 'manual_adjustment', 'purchase_redemption', 'loyalty_reward'
  reference_type text, -- 'sale', 'refund', 'manual'
  reference_id uuid, -- ID of the sale or refund
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credit_history_customer ON public.customer_store_credit_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_history_tenant ON public.customer_store_credit_history(tenant_id);

ALTER TABLE public.customer_store_credit_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_store_credit_history' AND policyname='store_credit_history_tenant') THEN
    CREATE POLICY "store_credit_history_tenant" ON public.customer_store_credit_history USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ── MARKETING AUTOMATION ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','completed','paused')),
  campaign_type text NOT NULL CHECK (campaign_type IN ('email','sms','whatsapp','manual')),
  audience_filter jsonb DEFAULT '{}',
  content text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_automation_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL, -- 'customer_created', 'sale_completed', 'birthday_upcoming', 'repair_completed'
  trigger_config jsonb DEFAULT '{}',
  action_type text NOT NULL, -- 'send_email', 'send_sms', 'create_task', 'add_tag'
  action_config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_automation_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_campaigns' AND policyname='marketing_campaigns_tenant') THEN
    CREATE POLICY "marketing_campaigns_tenant" ON public.marketing_campaigns USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_automation_rules' AND policyname='marketing_automation_tenant') THEN
    CREATE POLICY "marketing_automation_tenant" ON public.marketing_automation_rules USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ── TASK ACTIVITIES (Timeline) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type text NOT NULL, -- 'created', 'assigned', 'status_change', 'priority_change', 'comment_added', 'attachment_added'
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activities_task ON public.task_activities(task_id);
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_activities' AND policyname='task_activities_tenant') THEN
    CREATE POLICY "task_activities_tenant" ON public.task_activities USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- ── AUDIT LOGS EXPANSION ──────────────────────────────────────
-- (Ensuring we have index for entity_id to quickly find logs for a specific object)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ── SALES TABLE UPDATES ─────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='store_credit_amount') THEN
    ALTER TABLE public.sales ADD COLUMN store_credit_amount NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- ── STORE CREDIT TRIGGER ─────────────────────────────────────
-- Automatically create history record when store_credit on customers is updated manually
CREATE OR REPLACE FUNCTION public.track_store_credit_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.store_credit IS DISTINCT FROM NEW.store_credit THEN
    INSERT INTO public.customer_store_credit_history (
      tenant_id,
      customer_id,
      amount,
      balance_after,
      reason,
      reference_type,
      created_by
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.store_credit - COALESCE(OLD.store_credit, 0),
      NEW.store_credit,
      'Manual adjustment',
      'manual',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We only add this if we want to catch manual updates via dashboard.
-- Better to handle this in application code for specific reasons, but trigger is a safety net.
-- However, we'll rely on app code for now to provide specific reasons.
