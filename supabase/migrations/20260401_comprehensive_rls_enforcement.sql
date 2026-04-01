-- ============================================================================
-- COMPREHENSIVE RLS ENFORCEMENT
-- Fixes Supabase security alert: "Table publicly accessible"
-- All tables MUST have RLS enabled, even if policies allow access
-- ============================================================================

-- =============================================================================
-- 1. ADMIN/SYSTEM TABLES (service role only - no tenant isolation needed)
-- =============================================================================

-- admin_revenue_snapshots: Platform-wide revenue metrics (admin dashboard only)
ALTER TABLE IF EXISTS public.admin_revenue_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_revenue_snapshots_service_only" ON public.admin_revenue_snapshots;
CREATE POLICY "admin_revenue_snapshots_service_only" ON public.admin_revenue_snapshots
  FOR ALL USING (false);
-- Access only via service role key (bypasses RLS)

-- supported_currencies: Reference data (read-only for all authenticated users)
ALTER TABLE IF EXISTS public.supported_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supported_currencies_read_authenticated" ON public.supported_currencies;
CREATE POLICY "supported_currencies_read_authenticated" ON public.supported_currencies
  FOR SELECT USING (auth.role() = 'authenticated');

-- currency_exchange_rates: Reference data (read-only for authenticated)
ALTER TABLE IF EXISTS public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "currency_exchange_rates_read_authenticated" ON public.currency_exchange_rates;
CREATE POLICY "currency_exchange_rates_read_authenticated" ON public.currency_exchange_rates
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 2. TENANT-ISOLATED TABLES (standard tenant_id policy)
-- =============================================================================

-- mailchimp_sync_log: Sync logs per tenant
ALTER TABLE IF EXISTS public.mailchimp_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mailchimp_sync_log_tenant" ON public.mailchimp_sync_log;
CREATE POLICY "mailchimp_sync_log_tenant" ON public.mailchimp_sync_log
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- scheduled_report_logs: Report execution logs (join to scheduled_reports for tenant)
ALTER TABLE IF EXISTS public.scheduled_report_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_report_logs_tenant" ON public.scheduled_report_logs;
CREATE POLICY "scheduled_report_logs_tenant" ON public.scheduled_report_logs
  FOR ALL USING (
    scheduled_report_id IN (
      SELECT id FROM public.scheduled_reports WHERE tenant_id = public.get_tenant_id()
    )
  );

-- whatsapp_campaigns: Marketing campaigns per tenant
ALTER TABLE IF EXISTS public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_campaigns_tenant" ON public.whatsapp_campaigns;
CREATE POLICY "whatsapp_campaigns_tenant" ON public.whatsapp_campaigns
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- whatsapp_sends: Individual sends per tenant
ALTER TABLE IF EXISTS public.whatsapp_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_sends_tenant" ON public.whatsapp_sends;
CREATE POLICY "whatsapp_sends_tenant" ON public.whatsapp_sends
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- marketing_purchases: Stripe purchases for marketing credits
ALTER TABLE IF EXISTS public.marketing_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_purchases_tenant" ON public.marketing_purchases;
CREATE POLICY "marketing_purchases_tenant" ON public.marketing_purchases
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- =============================================================================
-- 3. VERIFICATION: Re-enable RLS on any tables that might have it disabled
-- (Belt and suspenders - ensure ALL tables have RLS even if already set)
-- =============================================================================

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
    AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 4. AUDIT: Log all tables and their RLS status for verification
-- =============================================================================

-- This will show in migration output - all should be TRUE
DO $$
DECLARE
  tbl RECORD;
  count_no_rls INTEGER := 0;
BEGIN
  FOR tbl IN 
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename
  LOOP
    IF NOT tbl.rowsecurity THEN
      count_no_rls := count_no_rls + 1;
      RAISE NOTICE 'WARNING: Table % has RLS DISABLED', tbl.tablename;
    END IF;
  END LOOP;
  
  IF count_no_rls = 0 THEN
    RAISE NOTICE 'SUCCESS: All public tables have RLS enabled';
  ELSE
    RAISE NOTICE 'ALERT: % tables still have RLS disabled', count_no_rls;
  END IF;
END $$;
