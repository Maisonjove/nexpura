-- Add notification preferences to team_members
-- Allows admins to configure per-employee notifications for new repairs and custom orders

-- Add notification columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_members' AND column_name = 'notify_new_repairs'
  ) THEN
    ALTER TABLE team_members ADD COLUMN notify_new_repairs boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_members' AND column_name = 'notify_new_bespoke'
  ) THEN
    ALTER TABLE team_members ADD COLUMN notify_new_bespoke boolean DEFAULT false;
  END IF;
END $$;

-- Comment on columns
COMMENT ON COLUMN team_members.notify_new_repairs IS 'Send SMS/WhatsApp notification when new repair is created';
COMMENT ON COLUMN team_members.notify_new_bespoke IS 'Send SMS/WhatsApp notification when new custom order is created';
