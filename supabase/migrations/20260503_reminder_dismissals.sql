-- Reminder dismissals + snooze state for /reminders.
--
-- Why: /reminders aggregates from tasks + repairs + bespoke + laybys
-- + customer events — all derived data with no first-class reminder
-- record. Group 14 audit required snooze/dismiss/complete actions on
-- the list, which need somewhere to persist the user's intent so the
-- reminder doesn't re-appear next page load.
--
-- This table holds per-user-per-reminder action state. The
-- reminder_key is composed from source_type + source_id (e.g.
-- "task:abc123", "repair:def456", "customer_birthday:xyz789"); the
-- /reminders aggregator filters out keys present here when
-- dismissed_at is set OR snoozed_until > now().

CREATE TABLE IF NOT EXISTS reminder_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('snooze', 'dismiss')),
  snoozed_until TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active dismiss/snooze per (user, reminder). Latest write wins —
-- staff can re-snooze or convert a snooze to a permanent dismiss.
CREATE UNIQUE INDEX IF NOT EXISTS reminder_dismissals_user_key
  ON reminder_dismissals(user_id, reminder_key);

CREATE INDEX IF NOT EXISTS reminder_dismissals_tenant
  ON reminder_dismissals(tenant_id);

-- RLS: users see only their own row state.
ALTER TABLE reminder_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminder_dismissals_select_own ON reminder_dismissals;
CREATE POLICY reminder_dismissals_select_own ON reminder_dismissals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS reminder_dismissals_insert_own ON reminder_dismissals;
CREATE POLICY reminder_dismissals_insert_own ON reminder_dismissals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reminder_dismissals_update_own ON reminder_dismissals;
CREATE POLICY reminder_dismissals_update_own ON reminder_dismissals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS reminder_dismissals_delete_own ON reminder_dismissals;
CREATE POLICY reminder_dismissals_delete_own ON reminder_dismissals
  FOR DELETE USING (auth.uid() = user_id);
