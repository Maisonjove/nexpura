-- ============================================================================
-- SECURITY ENHANCEMENTS
-- 1. User sessions tracking for active session management
-- 2. Login alerts infrastructure
-- 3. Encrypted fields support columns
-- ============================================================================

-- =============================================================================
-- 1. USER SESSIONS TABLE
-- Tracks active sessions for security monitoring
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  device_info TEXT NOT NULL DEFAULT 'Unknown',
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  location TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON public.user_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON public.user_sessions(session_token_hash);

-- RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
DROP POLICY IF EXISTS "user_sessions_select_own" ON public.user_sessions;
CREATE POLICY "user_sessions_select_own" ON public.user_sessions
  FOR SELECT USING (user_id = auth.uid());

-- Users can only delete their own sessions
DROP POLICY IF EXISTS "user_sessions_delete_own" ON public.user_sessions;
CREATE POLICY "user_sessions_delete_own" ON public.user_sessions
  FOR DELETE USING (user_id = auth.uid());

-- Insert/update via service role only (from server)
DROP POLICY IF EXISTS "user_sessions_insert_service" ON public.user_sessions;
CREATE POLICY "user_sessions_insert_service" ON public.user_sessions
  FOR INSERT WITH CHECK (false); -- Only service role can insert

DROP POLICY IF EXISTS "user_sessions_update_service" ON public.user_sessions;
CREATE POLICY "user_sessions_update_service" ON public.user_sessions
  FOR UPDATE USING (false); -- Only service role can update

-- =============================================================================
-- 2. LOGIN ALERTS TABLE
-- Records when alerts were sent to avoid spam
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.login_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'new_device',
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_alerts_user_device ON public.login_alerts(user_id, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_login_alerts_sent_at ON public.login_alerts(sent_at);

ALTER TABLE public.login_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
DROP POLICY IF EXISTS "login_alerts_select_own" ON public.login_alerts;
CREATE POLICY "login_alerts_select_own" ON public.login_alerts
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 3. CUSTOMERS TABLE - Add hash columns for encrypted field search
-- (Allows searching on encrypted email/phone without decrypting all records)
-- =============================================================================

ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS email_hash TEXT,
  ADD COLUMN IF NOT EXISTS phone_hash TEXT;

-- Indexes for hash-based search
CREATE INDEX IF NOT EXISTS idx_customers_email_hash ON public.customers(tenant_id, email_hash);
CREATE INDEX IF NOT EXISTS idx_customers_phone_hash ON public.customers(tenant_id, phone_hash);

-- =============================================================================
-- 4. SECURITY SETTINGS TABLE
-- Per-tenant security configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_security_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  require_2fa BOOLEAN DEFAULT false,
  session_timeout_hours INTEGER DEFAULT 24,
  max_sessions_per_user INTEGER DEFAULT 10,
  ip_allowlist TEXT[], -- NULL means all IPs allowed
  notify_on_new_device BOOLEAN DEFAULT true,
  notify_on_password_change BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenant_security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_security_settings_tenant" ON public.tenant_security_settings;
CREATE POLICY "tenant_security_settings_tenant" ON public.tenant_security_settings
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- =============================================================================
-- 5. CLEANUP: Auto-delete old sessions
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_sessions
  WHERE last_active_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM public.login_alerts
  WHERE sent_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
