-- GDPR Data Deletion Tracking
-- Tracks when users request account deletion

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

COMMENT ON COLUMN tenants.deletion_requested_at IS 'When the account owner requested data deletion';
COMMENT ON COLUMN tenants.deletion_scheduled_for IS 'When data will be permanently deleted (30 days after request)';

-- Index for the cleanup cron to find tenants scheduled for deletion
CREATE INDEX IF NOT EXISTS idx_tenants_deletion_scheduled 
ON tenants(deletion_scheduled_for) 
WHERE deletion_scheduled_for IS NOT NULL;
