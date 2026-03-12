-- ============================================================
-- 002_rls_policies.sql — Row Level Security
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the tenant_id for the currently authenticated user
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns the role for the currently authenticated user
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TENANTS POLICIES
-- ============================================================

-- Users can view their own tenant
CREATE POLICY "tenants_select_own"
  ON public.tenants FOR SELECT
  USING (id = auth.tenant_id());

-- Only owners can update their tenant
CREATE POLICY "tenants_update_owner"
  ON public.tenants FOR UPDATE
  USING (id = auth.tenant_id() AND auth.user_role() = 'owner');

-- Service role can insert (used during onboarding)
CREATE POLICY "tenants_insert_service"
  ON public.tenants FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Users can view all members of their tenant
CREATE POLICY "users_select_same_tenant"
  ON public.users FOR SELECT
  USING (tenant_id = auth.tenant_id());

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- Owners/managers can update any user in their tenant
CREATE POLICY "users_update_manager"
  ON public.users FOR UPDATE
  USING (tenant_id = auth.tenant_id() AND auth.user_role() IN ('owner', 'manager'));

-- Service role inserts (onboarding)
CREATE POLICY "users_insert_service"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- SUBSCRIPTIONS POLICIES
-- ============================================================

-- Tenant members can view subscription
CREATE POLICY "subscriptions_select_tenant"
  ON public.subscriptions FOR SELECT
  USING (tenant_id = auth.tenant_id());

-- Only owners can update subscription
CREATE POLICY "subscriptions_update_owner"
  ON public.subscriptions FOR UPDATE
  USING (tenant_id = auth.tenant_id() AND auth.user_role() = 'owner');

-- Service role inserts
CREATE POLICY "subscriptions_insert_service"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- AUDIT LOGS POLICIES
-- ============================================================

-- Owners/managers can view logs for their tenant
CREATE POLICY "audit_logs_select_manager"
  ON public.audit_logs FOR SELECT
  USING (tenant_id = auth.tenant_id() AND auth.user_role() IN ('owner', 'manager'));

-- Anyone in the tenant can insert logs
CREATE POLICY "audit_logs_insert_tenant"
  ON public.audit_logs FOR INSERT
  WITH CHECK (tenant_id = auth.tenant_id());
