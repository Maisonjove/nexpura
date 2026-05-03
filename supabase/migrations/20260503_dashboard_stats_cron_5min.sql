-- Reduce dashboard-stats cron cadence from 60s to 5min.
--
-- Why: pg_stat_statements showed refresh_all_active_dashboard_stats() at
-- 19,507 calls / 6,307 s of CPU time over ~14 days — 32% of total query
-- time on the DB and the single largest source of Disk IO usage. The
-- migration that introduced the 60s cadence (20260419) admits the only
-- weak spot it solves is "the first visitor after >60s of no writes
-- pays the live-compute cost". On-write triggers + stale-while-revalidate
-- already keep the dashboard fresh during normal use; pre-emptive sub-
-- minute refreshes mostly recompute rows nothing has read yet.
--
-- Net: 5x reduction in IO from this source. Dashboards still feel live
-- because every sale/invoice/repair/bespoke action calls
-- refreshDashboardStatsAsync(tenantId) directly via after().

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'refresh-dashboard-stats-60s';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(v_jobid, schedule := '*/5 * * * *');
  END IF;
END $$;
