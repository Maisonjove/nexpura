-- fx_rates table — Phase 1.5 post-audit.
--
-- Joey 2026-05-03: the per-currency MRR breakdown on /admin/revenue
-- gets a single "≈ A$X total (FX rates updated daily)" line below it
-- that converts non-AUD lines into approximate AUD via daily-cached
-- FX rates. This table holds the cache.
--
-- Source: exchangerate.host (free, no API key, supports AUD/USD/GBP/EUR).
-- Cron at /api/cron/fx-refresh writes one row per pair daily 02:00 UTC.
--
-- Read-side: src/lib/plans.ts convertMRRToAUD() looks up the latest
-- row per (base, target) and treats anything older than 7 days as
-- stale → /admin/revenue renders "≈ A$— (FX rate stale)" rather than
-- silently using a stale rate.
--
-- Schema: one row per (base_currency, target_currency, fetched_at)
-- triple. We keep history rather than upsert-overwrite so an
-- after-the-fact MRR audit can rerun against the rate that was
-- actually in effect on a given day.

CREATE TABLE IF NOT EXISTS fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'exchangerate.host',

  CHECK (base_currency IN ('AUD', 'USD', 'GBP', 'EUR')),
  CHECK (target_currency IN ('AUD', 'USD', 'GBP', 'EUR')),
  CHECK (rate > 0)
);

CREATE INDEX IF NOT EXISTS fx_rates_pair_fetched_idx
  ON fx_rates(base_currency, target_currency, fetched_at DESC);

-- RLS: this table is global, not tenant-scoped. Authenticated users
-- can read (the /admin/revenue page renders rates for the AUD-total
-- conversion). Only service-role writes — the cron route uses admin
-- client.
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fx_rates_authenticated_select ON fx_rates;
CREATE POLICY fx_rates_authenticated_select ON fx_rates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE are service-role-only by default (no policy =
-- no access for authenticated). The cron route bypasses RLS via
-- createAdminClient.

COMMENT ON TABLE fx_rates
  IS 'Daily-cached FX rates from exchangerate.host. Used by /admin/revenue ≈ AUD-total conversion. Stale > 7 days → UI shows ≈ A$— per Joey 2026-05-03 spec.';
