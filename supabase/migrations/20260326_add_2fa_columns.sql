-- Migration: Add Two-Factor Authentication columns to users table
-- Run this migration in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/sql

-- Add 2FA columns to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_totp_enabled ON public.users(totp_enabled) WHERE totp_enabled = true;

-- Add comments for documentation
COMMENT ON COLUMN public.users.totp_enabled IS 'Whether two-factor authentication is enabled for this user';
COMMENT ON COLUMN public.users.totp_secret IS 'TOTP secret key (base32 encoded) - should be encrypted at rest';
COMMENT ON COLUMN public.users.totp_backup_codes IS 'SHA-256 hashed backup codes for 2FA recovery (null entries = used codes)';
