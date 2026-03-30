-- Global passport identity number (unique across ALL tenants)
-- Starts at 100000001 and increments by 1 for each new passport

-- Create a global sequence for passport identity numbers
CREATE SEQUENCE IF NOT EXISTS passport_identity_seq
  START WITH 100000001
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE;

-- Add identity_number column to passports table
ALTER TABLE passports
ADD COLUMN IF NOT EXISTS identity_number BIGINT UNIQUE;

-- Create or replace the function to generate passport UID with identity number
CREATE OR REPLACE FUNCTION generate_passport_uid()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_identity BIGINT;
BEGIN
  -- Get next value from global sequence
  new_identity := nextval('passport_identity_seq');
  -- Return as string (the identity number IS the UID now)
  RETURN new_identity::TEXT;
END;
$$;

-- Create a function to get just the identity number (for cases where we need it separately)
CREATE OR REPLACE FUNCTION next_passport_identity()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN nextval('passport_identity_seq');
END;
$$;

-- Backfill existing passports with identity numbers (preserving their existing UIDs)
-- They get sequential IDs but starting before the new sequence
DO $$
DECLARE
  passport_record RECORD;
  counter BIGINT := 100000001;
  existing_count BIGINT;
BEGIN
  -- Count existing passports
  SELECT COUNT(*) INTO existing_count FROM passports WHERE identity_number IS NULL;
  
  IF existing_count > 0 THEN
    -- Reset sequence to account for existing records
    -- New passports will start after existing ones
    PERFORM setval('passport_identity_seq', 100000001 + existing_count);
    
    -- Assign identity numbers to existing passports
    FOR passport_record IN 
      SELECT id FROM passports 
      WHERE identity_number IS NULL 
      ORDER BY created_at ASC
    LOOP
      UPDATE passports SET identity_number = counter WHERE id = passport_record.id;
      counter := counter + 1;
    END LOOP;
  END IF;
END $$;

-- Make identity_number NOT NULL after backfill
ALTER TABLE passports
ALTER COLUMN identity_number SET NOT NULL;

-- Add comment
COMMENT ON COLUMN passports.identity_number IS 'Global unique identity number across all tenants, starting at 100000001';
COMMENT ON SEQUENCE passport_identity_seq IS 'Global sequence for passport identity numbers, shared across all tenants';
