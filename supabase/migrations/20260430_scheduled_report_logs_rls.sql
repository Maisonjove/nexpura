-- ============================================================
-- Enable RLS on scheduled_report_logs.
--
-- Supabase advisor (2026-04-27) flagged this as the only public
-- table with `rls_disabled_in_public` — anyone with the project
-- URL could read/edit/delete every tenant's report-execution logs
-- via the Supabase REST API.
--
-- The 20260401_comprehensive_rls_enforcement.sql migration was
-- intended to cover this table but never landed in prod (no row
-- in supabase_migrations.schema_migrations matching that prefix).
-- Re-asserting the fix here as its own migration.
--
-- Rows are written by the cron-side admin client (service_role
-- bypasses RLS), so the only RLS-relevant access is SELECT from
-- authenticated app users — a single FOR ALL policy gating on
-- `tenant_id = get_tenant_id()` is sufficient. Tenant scope comes
-- from the table's own tenant_id column, no join required.
--
-- Schema reference: supabase/migrations/20260326_scheduled_reports.sql
-- ============================================================

ALTER TABLE public.scheduled_report_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_report_logs_tenant" ON public.scheduled_report_logs;
CREATE POLICY "scheduled_report_logs_tenant" ON public.scheduled_report_logs
  FOR ALL USING (tenant_id = public.get_tenant_id());
