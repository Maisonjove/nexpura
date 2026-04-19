-- Proactive refresh scheduler for tenant_dashboard_stats.
--
-- Previous pass landed the precomputed read model + write-triggered
-- refreshes + stale-while-revalidate fallback on read. That leaves one
-- weak spot: when no writes occurred for a while AND the row crosses the
-- 60 s stale threshold, the NEXT visitor pays the live-compute cost AND
-- triggers the refresh.
--
-- Fix: pg_cron job running every 60 s that proactively refreshes the
-- stats row for every currently-alive, recently-active tenant. The row
-- stays <60 s old without requiring a user visit to kick it.
--
-- Scope: only refresh tenants where the dashboard has been visited at
-- least once (stats row exists) AND there's been activity in the last
-- 30 days (recent repair OR sale OR bespoke update). Long-dormant
-- tenants don't need a ticking refresh; their row will get updated via
-- the existing on-demand path when they come back.
--
-- Safety: pg_cron jobs run as the postgres role inside the DB. No
-- public HTTP endpoint involved; nothing an external caller can abuse.

-- Wrapper function: iterates active tenants and refreshes each. Returns
-- the number of tenants refreshed (useful for monitoring).
CREATE OR REPLACE FUNCTION refresh_all_active_dashboard_stats()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_tenant IN
    -- Only tenants that have used the dashboard at least once AND have
    -- meaningful activity in the last 30 days.
    SELECT DISTINCT s.tenant_id
    FROM tenant_dashboard_stats s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE t.deleted_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM repairs r WHERE r.tenant_id = s.tenant_id AND r.updated_at > now() - interval '30 days' LIMIT 1)
        OR EXISTS (SELECT 1 FROM sales sa WHERE sa.tenant_id = s.tenant_id AND sa.created_at > now() - interval '30 days' LIMIT 1)
        OR EXISTS (SELECT 1 FROM bespoke_jobs b WHERE b.tenant_id = s.tenant_id AND b.updated_at > now() - interval '30 days' LIMIT 1)
      )
  LOOP
    -- Each tenant refresh is wrapped in its own exception handler inside
    -- refresh_tenant_dashboard_stats so a failure on one tenant doesn't
    -- abort the batch.
    PERFORM refresh_tenant_dashboard_stats(v_tenant.tenant_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION refresh_all_active_dashboard_stats() IS
  'Refreshes tenant_dashboard_stats for every tenant that has an existing row AND activity in the last 30 days. Invoked by a pg_cron job every 60 s; also callable ad-hoc for diagnostics.';

-- Unschedule any prior job with this name so the migration is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-dashboard-stats-60s') THEN
    PERFORM cron.unschedule('refresh-dashboard-stats-60s');
  END IF;
END $$;

-- Schedule: every minute. Calls the wrapper which iterates active tenants.
SELECT cron.schedule(
  'refresh-dashboard-stats-60s',
  '* * * * *',
  $$SELECT refresh_all_active_dashboard_stats();$$
);
