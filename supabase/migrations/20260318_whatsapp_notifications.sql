-- ============================================================
-- WHATSAPP EMPLOYEE NOTIFICATIONS
-- Add phone numbers to team_members and notification settings
-- ============================================================

-- Add phone_number to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled boolean DEFAULT true;

-- Add notification settings to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{
    "whatsapp_employee_notifications": false,
    "notify_on_task_assignment": true,
    "notify_on_status_change": true,
    "notify_on_urgent_flagged": true
  }';

-- Add column to track WhatsApp notification sent
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS last_whatsapp_notification_at timestamptz;

-- Add column to tasks table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS last_whatsapp_notification_at timestamptz;
  END IF;
END $$;

-- Add assigned_to for repairs and bespoke_jobs
ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false;

ALTER TABLE public.bespoke_jobs
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_repairs_assigned ON public.repairs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bespoke_assigned ON public.bespoke_jobs(assigned_to);
