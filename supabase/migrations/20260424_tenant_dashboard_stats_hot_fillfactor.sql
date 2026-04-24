-- Perf finding: the precomputed `tenant_dashboard_stats` table has
-- 126k+ updates per hour against only ~35 live rows, but
-- n_tup_hot_upd = 0 — Postgres never picks the HOT (heap-only-tuple)
-- optimisation, so every refresh writes a new row version on a new
-- page and the index entries pile up. Over weeks this bloats the
-- table size and index pages regardless of VACUUM cadence.
--
-- HOT updates fire when (a) no indexed column changes in the UPDATE
-- AND (b) the new row fits in the same page. Condition (a) holds
-- here — we only update non-indexed jsonb/numeric columns. Condition
-- (b) is the problem: tenant_dashboard_stats has ~15 jsonb columns
-- per row (stage counts, sparklines, recent lists), so each row is
-- dense and the default fillfactor=100 leaves zero slack.
--
-- Dropping fillfactor to 60 reserves 40% of each page for in-place
-- HOT updates. Takes effect on future UPDATE statements. A one-time
-- VACUUM FULL would also reclaim existing bloat, but that's an
-- exclusive lock and deserves a deliberate maintenance-window
-- decision — not migrated automatically.

ALTER TABLE public.tenant_dashboard_stats SET (fillfactor = 60);

-- Nudge Postgres to re-evaluate on the next UPDATE wave.
-- (No data change; cheap.)
ANALYZE public.tenant_dashboard_stats;
