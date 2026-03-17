-- Team member location access control
-- Allows assigning specific stores a team member can access

-- Add allowed_location_ids array to team_members
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='allowed_location_ids') THEN
    ALTER TABLE public.team_members ADD COLUMN allowed_location_ids uuid[] DEFAULT NULL;
    -- NULL means access to all locations (for owners/managers)
    -- Empty array means no location access
    -- Array with values means only those locations
  END IF;
END $$;

-- Add department/position field if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='department') THEN
    ALTER TABLE public.team_members ADD COLUMN department text;
  END IF;
END $$;

-- Add last_login tracking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='last_login_at') THEN
    ALTER TABLE public.team_members ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Create index for location access queries
CREATE INDEX IF NOT EXISTS idx_team_members_location_access ON public.team_members USING GIN (allowed_location_ids);
