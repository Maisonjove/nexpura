-- Atomic recompute of stocktakes.total_items_counted and
-- stocktakes.total_discrepancies. Pre-fix the application code did
-- read-all-items + JS-aggregate + UPDATE-parent, with no MVCC guarantee
-- between the read and the write. Two staff counting at the same time
-- could each read a pre-other-write snapshot and undercount.
--
-- This RPC does the count-and-set in a single SQL statement so the
-- aggregation and the write share an MVCC snapshot. No race.
--
-- It also fixes a long-standing logic error: the previous JS code
-- selected `discrepancy` from stocktake_items, but that column has
-- never existed on the table — every row's `discrepancy` was null,
-- the JS check `i.discrepancy !== 0` was therefore always true, and
-- total_discrepancies tracked total_items_counted exactly. Here we
-- compare counted_qty to expected_qty directly.

CREATE OR REPLACE FUNCTION public.recompute_stocktake_totals(
  p_stocktake_id uuid,
  p_tenant_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stocktakes
  SET
    total_items_counted = (
      SELECT count(*)::int
      FROM public.stocktake_items
      WHERE stocktake_id = p_stocktake_id
        AND tenant_id    = p_tenant_id
        AND counted_qty IS NOT NULL
    ),
    total_discrepancies = (
      SELECT count(*)::int
      FROM public.stocktake_items
      WHERE stocktake_id = p_stocktake_id
        AND tenant_id    = p_tenant_id
        AND counted_qty IS NOT NULL
        AND counted_qty <> expected_qty
    )
  WHERE id        = p_stocktake_id
    AND tenant_id = p_tenant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_stocktake_totals(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_stocktake_totals(uuid, uuid) TO service_role;
