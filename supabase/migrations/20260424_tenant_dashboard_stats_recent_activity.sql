-- Extend the precomputed `tenant_dashboard_stats` read model with the
-- "Recent activity" widget payload. Before this, /api/dashboard/stats
-- issued two live joins (bespoke_jobs + customers, repairs + customers,
-- ordered by updated_at DESC LIMIT 5) on every call — the last two
-- live queries on the cold fast path. With this column populated by the
-- 60 s refresh, the fast path becomes a single-row read with zero live
-- joins (tasks_today is still live; it's per-user scoped).
--
-- Shape: normalized mixed array of the 5 most-recently-touched
-- bespoke jobs + repairs for the tenant, with the customer name already
-- joined in. The renderer just maps straight to <RecentActivity /> list
-- items. Matches the client-side merge in readPrecomputedStats so
-- either code path produces identical output.

ALTER TABLE public.tenant_dashboard_stats
  ADD COLUMN IF NOT EXISTS recent_activity JSONB NOT NULL DEFAULT '[]';

-- Replace refresh function: adds `recent_activity` population.
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
  v_recent_activity JSONB;
  v_rev_spark JSONB;
  v_count_spark JSONB;
  v_rep_spark JSONB;
  v_cust_spark JSONB;
  v_bar_data JSONB;
  v_stage_data JSONB;
BEGIN
  SELECT COALESCE(timezone, 'Australia/Sydney') INTO v_tz
    FROM tenants WHERE id = p_tenant_id;
  v_today := (now() AT TIME ZONE v_tz)::DATE;
  v_month_start := date_trunc('month', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;

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

  -- Recent activity: mixed (bespoke + repairs), pre-sorted by updated_at,
  -- customer name joined. Matches the hydrated shape the client expects:
  -- { id, title, stage, customer_name, updated_at, type, href }.
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.updated_at DESC), '[]')
    INTO v_recent_activity
  FROM (
    (
      SELECT j.id,
             COALESCE(j.title, 'Untitled Job') AS title,
             COALESCE(j.stage, 'enquiry') AS stage,
             c.full_name AS customer_name,
             j.updated_at,
             'job'::TEXT AS type,
             ('/bespoke/' || j.id) AS href
      FROM bespoke_jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      WHERE j.tenant_id = p_tenant_id
        AND j.deleted_at IS NULL
      ORDER BY j.updated_at DESC
      LIMIT 5
    )
    UNION ALL
    (
      SELECT r.id,
             COALESCE(r.item_description, 'Repair') AS title,
             COALESCE(r.stage, 'intake') AS stage,
             c.full_name AS customer_name,
             r.updated_at,
             'repair'::TEXT AS type,
             ('/repairs/' || r.id) AS href
      FROM repairs r
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.tenant_id = p_tenant_id
        AND r.deleted_at IS NULL
      ORDER BY r.updated_at DESC
      LIMIT 5
    )
    ORDER BY updated_at DESC
    LIMIT 5
  ) t;

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

  INSERT INTO tenant_dashboard_stats (
    tenant_id, sales_this_month_revenue, sales_this_month_count,
    total_outstanding, overdue_invoice_count, active_jobs_count,
    active_repairs_count, overdue_repairs, low_stock_items,
    ready_for_pickup, active_repairs_list, active_bespoke_list,
    recent_sales, recent_repairs_list, recent_activity, revenue_sparkline,
    sales_count_sparkline, repairs_sparkline, customers_sparkline,
    sales_bar_data, repair_stage_data, computed_at, last_refresh_error
  ) VALUES (
    p_tenant_id, v_sales_revenue, v_sales_count,
    v_outstanding, v_overdue_inv_count, v_active_jobs,
    v_active_repairs, v_overdue_repairs, v_low_stock,
    v_ready_all, v_active_rep_list, v_active_bsp_list,
    v_recent_sales, v_recent_rep, v_recent_activity, v_rev_spark,
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
    recent_activity = EXCLUDED.recent_activity,
    revenue_sparkline = EXCLUDED.revenue_sparkline,
    sales_count_sparkline = EXCLUDED.sales_count_sparkline,
    repairs_sparkline = EXCLUDED.repairs_sparkline,
    customers_sparkline = EXCLUDED.customers_sparkline,
    sales_bar_data = EXCLUDED.sales_bar_data,
    repair_stage_data = EXCLUDED.repair_stage_data,
    computed_at = now(),
    last_refresh_error = NULL;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO tenant_dashboard_stats (tenant_id, last_refresh_error, computed_at)
  VALUES (p_tenant_id, SQLERRM, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    last_refresh_error = EXCLUDED.last_refresh_error;
  RAISE NOTICE 'refresh_tenant_dashboard_stats(%) failed: %', p_tenant_id, SQLERRM;
END;
$$;

-- Backfill `recent_activity` for existing rows so the fast path returns
-- populated data immediately, not empty arrays until the next on-write /
-- scheduler refresh. Calling refresh for every tenant with an existing row
-- picks up all the new fields in one pass.
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT tenant_id FROM tenant_dashboard_stats
  LOOP
    PERFORM refresh_tenant_dashboard_stats(t_id);
  END LOOP;
END;
$$;
