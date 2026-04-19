-- Precomputed per-tenant dashboard read model.
--
-- Problem: the dashboard's 20-query parallel batch set a TTFB floor of
-- ~1.5 s on cold Redis cache. The slowest of the 20 queries dominates, and
-- most of those queries are tenant-wide aggregates that change slowly.
--
-- Design: one row per tenant containing the entire aggregate payload as
-- typed columns + a jsonb bag for the "top-N row lists". Refreshed by a
-- SQL function that runs all 20 sub-queries in a single DB round-trip from
-- the app. The dashboard reads this one row (<10 ms). Staleness bounded by
-- "refresh on write" in action handlers + "stale-while-revalidate" in the
-- dashboard read path (stale row served; background refresh via next/after).
--
-- Trade-off: up to 60 s staleness on most aggregates when writes happen.
-- Explicitly invalidated on the hot writes (repair/bespoke create+stage,
-- invoice create+payment, sale create, customer create, inventory adjust).

CREATE TABLE IF NOT EXISTS tenant_dashboard_stats (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  -- Scalar aggregates
  sales_this_month_revenue NUMERIC NOT NULL DEFAULT 0,
  sales_this_month_count INTEGER NOT NULL DEFAULT 0,
  total_outstanding NUMERIC NOT NULL DEFAULT 0,
  overdue_invoice_count INTEGER NOT NULL DEFAULT 0,
  active_jobs_count INTEGER NOT NULL DEFAULT 0,
  active_repairs_count INTEGER NOT NULL DEFAULT 0,
  -- Row-list payloads stored as jsonb. Small (≤10 rows each). Keeping them
  -- inline avoids a second fetch per widget.
  overdue_repairs JSONB NOT NULL DEFAULT '[]',
  low_stock_items JSONB NOT NULL DEFAULT '[]',
  ready_for_pickup JSONB NOT NULL DEFAULT '[]',
  active_repairs_list JSONB NOT NULL DEFAULT '[]',
  active_bespoke_list JSONB NOT NULL DEFAULT '[]',
  recent_sales JSONB NOT NULL DEFAULT '[]',
  recent_repairs_list JSONB NOT NULL DEFAULT '[]',
  revenue_sparkline JSONB NOT NULL DEFAULT '[]',
  sales_count_sparkline JSONB NOT NULL DEFAULT '[]',
  repairs_sparkline JSONB NOT NULL DEFAULT '[]',
  customers_sparkline JSONB NOT NULL DEFAULT '[]',
  sales_bar_data JSONB NOT NULL DEFAULT '[]',
  repair_stage_data JSONB NOT NULL DEFAULT '[]',
  -- Bookkeeping
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- If the last refresh failed we surface the last good row AND log the
  -- error so operators can see it without breaking the read path.
  last_refresh_error TEXT
);

-- Idx not strictly required (PK handles lookup) but handy for refresh-
-- staleness scans.
CREATE INDEX IF NOT EXISTS idx_tenant_dashboard_stats_computed_at
  ON tenant_dashboard_stats(computed_at DESC);

ALTER TABLE tenant_dashboard_stats ENABLE ROW LEVEL SECURITY;

-- Authenticated staff read their tenant's row only.
CREATE POLICY tenant_dashboard_stats_select_tenant
  ON tenant_dashboard_stats FOR SELECT
  USING (tenant_id = get_tenant_id());

-- Writes go through the service-role admin client from server actions; no
-- RLS policy needed for service_role (it bypasses RLS).

-- ────────────────────────────────────────────────────────────────────────
-- Refresh function.
--
-- Runs all 20 sub-queries server-side in a single DB call and upserts the
-- tenant_dashboard_stats row. Client invokes via supabase.rpc('refresh_
-- tenant_dashboard_stats', { p_tenant_id: ... }).
--
-- SECURITY DEFINER because callers will be service_role anyway; we rely on
-- the tenant_id param for scoping. Function body intentionally mirrors the
-- logic in src/app/(app)/dashboard/actions.ts fetchDashboardStats so the
-- two stay consistent.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_tenant_dashboard_stats(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz TEXT := 'Australia/Sydney';
  v_today DATE;
  v_month_start TIMESTAMPTZ;
  v_seven_days_ago TIMESTAMPTZ := now() - interval '7 days';

  v_sales_revenue NUMERIC;
  v_sales_count INTEGER;
  v_outstanding NUMERIC;
  v_overdue_inv_count INTEGER;
  v_active_jobs INTEGER;
  v_active_repairs INTEGER;

  v_overdue_repairs JSONB;
  v_low_stock JSONB;
  v_ready_repairs JSONB;
  v_ready_bespoke JSONB;
  v_ready_all JSONB;
  v_active_rep_list JSONB;
  v_active_bsp_list JSONB;
  v_recent_sales JSONB;
  v_recent_rep JSONB;
  v_rev_spark JSONB;
  v_count_spark JSONB;
  v_rep_spark JSONB;
  v_cust_spark JSONB;
  v_bar_data JSONB;
  v_stage_data JSONB;
BEGIN
  -- Tenant timezone
  SELECT COALESCE(timezone, 'Australia/Sydney') INTO v_tz
    FROM tenants WHERE id = p_tenant_id;
  v_today := (now() AT TIME ZONE v_tz)::DATE;
  v_month_start := date_trunc('month', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  -- ── Scalar aggregates ────────────────────────────────────────────────
  SELECT COALESCE(SUM(total), 0), COALESCE(COUNT(*), 0)
    INTO v_sales_revenue, v_sales_count
    FROM sales
    WHERE tenant_id = p_tenant_id AND created_at >= v_month_start;

  SELECT COALESCE(SUM(GREATEST(0, amount_due)), 0) INTO v_outstanding
    FROM invoices
    WHERE tenant_id = p_tenant_id
      AND status IN ('partial','unpaid','overdue')
      AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_overdue_inv_count
    FROM invoices
    WHERE tenant_id = p_tenant_id
      AND status NOT IN ('paid','voided','draft','cancelled')
      AND due_date < v_today
      AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_active_jobs
    FROM bespoke_jobs
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NULL
      AND stage NOT IN ('completed','cancelled');

  SELECT COUNT(*) INTO v_active_repairs
    FROM repairs
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NULL
      AND stage NOT IN ('collected','cancelled');

  -- ── Row-list payloads as jsonb ───────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]')
    INTO v_overdue_repairs
  FROM (
    SELECT r.id, r.repair_number, r.item_description, r.due_date,
           r.location_id, c.full_name AS customer_name,
           GREATEST(0, (v_today - r.due_date)::INTEGER) AS days_overdue
    FROM repairs r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.tenant_id = p_tenant_id
      AND r.deleted_at IS NULL
      AND r.stage NOT IN ('collected','cancelled')
      AND r.due_date < v_today
    ORDER BY r.due_date ASC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]')
    INTO v_low_stock
  FROM (
    SELECT DISTINCT ON (COALESCE(sku, id::TEXT))
      id, name, sku, quantity, low_stock_threshold
    FROM inventory
    WHERE tenant_id = p_tenant_id
      AND status = 'active'
      AND deleted_at IS NULL
      AND track_quantity = true
      AND quantity <= COALESCE(low_stock_threshold, 1)
    ORDER BY COALESCE(sku, id::TEXT), quantity ASC
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_ready_repairs
  FROM (
    SELECT r.id, r.repair_number AS number, r.item_description AS label,
           c.full_name AS customer_name, 'repair' AS type, r.location_id
    FROM repairs r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.tenant_id = p_tenant_id
      AND r.stage = 'ready'
      AND r.deleted_at IS NULL
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_ready_bespoke
  FROM (
    SELECT j.id, j.job_number AS number, j.title AS label,
           c.full_name AS customer_name, 'bespoke' AS type, j.location_id
    FROM bespoke_jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    WHERE j.tenant_id = p_tenant_id
      AND j.stage = 'ready'
      AND j.deleted_at IS NULL
    LIMIT 5
  ) t;

  v_ready_all := (COALESCE(v_ready_repairs, '[]'::jsonb) || COALESCE(v_ready_bespoke, '[]'::jsonb));

  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_active_rep_list
  FROM (
    SELECT r.id, r.item_description AS item, r.stage, r.due_date,
           r.location_id, c.full_name AS customer_name
    FROM repairs r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.tenant_id = p_tenant_id
      AND r.deleted_at IS NULL
      AND r.stage NOT IN ('collected','cancelled')
    ORDER BY r.due_date ASC NULLS LAST
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_active_bsp_list
  FROM (
    SELECT j.id, j.title, j.stage, j.due_date,
           j.location_id, c.full_name AS customer_name
    FROM bespoke_jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    WHERE j.tenant_id = p_tenant_id
      AND j.deleted_at IS NULL
      AND j.stage NOT IN ('completed','cancelled')
    ORDER BY j.due_date ASC NULLS LAST
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_recent_sales
  FROM (
    SELECT s.id, s.sale_number, c.full_name AS customer_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY s.created_at DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]') INTO v_recent_rep
  FROM (
    SELECT r.id, r.repair_number, c.full_name AS customer_name
    FROM repairs r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.tenant_id = p_tenant_id
      AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC
    LIMIT 5
  ) t;

  -- Sparklines — 7 daily buckets. We just emit daily totals; the dashboard
  -- formats them into {value} objects.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('value', daily_value) ORDER BY day), '[]')
    INTO v_rev_spark
  FROM (
    SELECT date_trunc('day', created_at AT TIME ZONE v_tz) AS day,
           COALESCE(SUM(total), 0) AS daily_value
      FROM sales
      WHERE tenant_id = p_tenant_id AND created_at >= v_seven_days_ago
      GROUP BY 1
      ORDER BY 1
  ) g;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('value', daily_value) ORDER BY day), '[]')
    INTO v_count_spark
  FROM (
    SELECT date_trunc('day', created_at AT TIME ZONE v_tz) AS day,
           COUNT(*) AS daily_value
      FROM sales
      WHERE tenant_id = p_tenant_id AND created_at >= v_seven_days_ago
      GROUP BY 1
      ORDER BY 1
  ) g;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('value', daily_value) ORDER BY day), '[]')
    INTO v_rep_spark
  FROM (
    SELECT date_trunc('day', created_at AT TIME ZONE v_tz) AS day,
           COUNT(*) AS daily_value
      FROM repairs
      WHERE tenant_id = p_tenant_id AND created_at >= v_seven_days_ago
      GROUP BY 1
      ORDER BY 1
  ) g;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('value', daily_value) ORDER BY day), '[]')
    INTO v_cust_spark
  FROM (
    SELECT date_trunc('day', created_at AT TIME ZONE v_tz) AS day,
           COUNT(*) AS daily_value
      FROM customers
      WHERE tenant_id = p_tenant_id AND created_at >= v_seven_days_ago
      GROUP BY 1
      ORDER BY 1
  ) g;

  -- Sales bar chart (7 days)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'day', to_char(day, 'Dy'),
           'sales', daily_count,
           'revenue', daily_revenue
         ) ORDER BY day), '[]')
    INTO v_bar_data
  FROM (
    SELECT date_trunc('day', created_at AT TIME ZONE v_tz) AS day,
           COUNT(*) AS daily_count,
           COALESCE(SUM(total), 0) AS daily_revenue
      FROM sales
      WHERE tenant_id = p_tenant_id AND created_at >= v_seven_days_ago
      GROUP BY 1
      ORDER BY 1
  ) g;

  -- Repair stage breakdown
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', stage, 'value', cnt)), '[]')
    INTO v_stage_data
  FROM (
    SELECT stage, COUNT(*) AS cnt
      FROM repairs
      WHERE tenant_id = p_tenant_id
        AND deleted_at IS NULL
        AND stage NOT IN ('collected','cancelled')
      GROUP BY stage
  ) g;

  -- ── Upsert ───────────────────────────────────────────────────────────
  INSERT INTO tenant_dashboard_stats (
    tenant_id, sales_this_month_revenue, sales_this_month_count,
    total_outstanding, overdue_invoice_count, active_jobs_count,
    active_repairs_count, overdue_repairs, low_stock_items,
    ready_for_pickup, active_repairs_list, active_bespoke_list,
    recent_sales, recent_repairs_list, revenue_sparkline,
    sales_count_sparkline, repairs_sparkline, customers_sparkline,
    sales_bar_data, repair_stage_data, computed_at, last_refresh_error
  ) VALUES (
    p_tenant_id, v_sales_revenue, v_sales_count,
    v_outstanding, v_overdue_inv_count, v_active_jobs,
    v_active_repairs, v_overdue_repairs, v_low_stock,
    v_ready_all, v_active_rep_list, v_active_bsp_list,
    v_recent_sales, v_recent_rep, v_rev_spark,
    v_count_spark, v_rep_spark, v_cust_spark,
    v_bar_data, v_stage_data, now(), NULL
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    sales_this_month_revenue = EXCLUDED.sales_this_month_revenue,
    sales_this_month_count = EXCLUDED.sales_this_month_count,
    total_outstanding = EXCLUDED.total_outstanding,
    overdue_invoice_count = EXCLUDED.overdue_invoice_count,
    active_jobs_count = EXCLUDED.active_jobs_count,
    active_repairs_count = EXCLUDED.active_repairs_count,
    overdue_repairs = EXCLUDED.overdue_repairs,
    low_stock_items = EXCLUDED.low_stock_items,
    ready_for_pickup = EXCLUDED.ready_for_pickup,
    active_repairs_list = EXCLUDED.active_repairs_list,
    active_bespoke_list = EXCLUDED.active_bespoke_list,
    recent_sales = EXCLUDED.recent_sales,
    recent_repairs_list = EXCLUDED.recent_repairs_list,
    revenue_sparkline = EXCLUDED.revenue_sparkline,
    sales_count_sparkline = EXCLUDED.sales_count_sparkline,
    repairs_sparkline = EXCLUDED.repairs_sparkline,
    customers_sparkline = EXCLUDED.customers_sparkline,
    sales_bar_data = EXCLUDED.sales_bar_data,
    repair_stage_data = EXCLUDED.repair_stage_data,
    computed_at = now(),
    last_refresh_error = NULL;

EXCEPTION WHEN OTHERS THEN
  -- Record the failure but do not propagate — the dashboard will fall back
  -- to live queries when the row is stale.
  INSERT INTO tenant_dashboard_stats (tenant_id, last_refresh_error, computed_at)
  VALUES (p_tenant_id, SQLERRM, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    last_refresh_error = EXCLUDED.last_refresh_error;
  RAISE NOTICE 'refresh_tenant_dashboard_stats(%) failed: %', p_tenant_id, SQLERRM;
END;
$$;

COMMENT ON FUNCTION refresh_tenant_dashboard_stats(UUID) IS
  'Recomputes tenant_dashboard_stats for one tenant. Callable via RPC from service_role.';

COMMENT ON TABLE tenant_dashboard_stats IS
  'Precomputed dashboard aggregate per tenant. Refreshed on-write (sales/invoices/repairs/bespoke) + stale-while-revalidate on read. Fallback to live compute if missing or >60s stale.';
