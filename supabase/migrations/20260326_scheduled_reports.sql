-- Scheduled Reports configuration table
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  report_type text NOT NULL, -- 'sales', 'inventory', 'repairs', 'financial', 'custom'
  schedule_type text NOT NULL DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
  schedule_day integer, -- 0-6 for weekly (0=Sunday), 1-31 for monthly
  schedule_time text DEFAULT '09:00', -- HH:MM format
  recipients jsonb NOT NULL DEFAULT '[]', -- array of email addresses
  include_csv boolean DEFAULT true,
  include_pdf boolean DEFAULT false,
  filters jsonb DEFAULT '{}', -- report-specific filters
  is_active boolean DEFAULT true,
  last_sent_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON public.scheduled_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at) WHERE is_active = true;

-- RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_select') THEN
    CREATE POLICY "scheduled_reports_select" ON public.scheduled_reports FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_insert') THEN
    CREATE POLICY "scheduled_reports_insert" ON public.scheduled_reports FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_update') THEN
    CREATE POLICY "scheduled_reports_update" ON public.scheduled_reports FOR UPDATE USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='scheduled_reports_delete') THEN
    CREATE POLICY "scheduled_reports_delete" ON public.scheduled_reports FOR DELETE USING (tenant_id = public.get_tenant_id());
  END IF;
END $$;

-- Report execution log
CREATE TABLE IF NOT EXISTS public.scheduled_report_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scheduled_report_id uuid NOT NULL REFERENCES public.scheduled_reports(id) ON DELETE CASCADE,
  status text NOT NULL, -- 'success', 'failed', 'partial'
  recipients_sent integer DEFAULT 0,
  recipients_failed integer DEFAULT 0,
  error_message text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_logs_report ON public.scheduled_report_logs(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_logs_created ON public.scheduled_report_logs(created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_scheduled_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scheduled_reports_updated_at ON public.scheduled_reports;
CREATE TRIGGER scheduled_reports_updated_at
  BEFORE UPDATE ON public.scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_reports_updated_at();
