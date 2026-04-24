-- Collapse the POS stock-deduction N+1 into a single RPC call.
--
-- Before: createPOSSale (src/app/(app)/pos/actions.ts) looped over the
-- cart and issued 3–4 queries per item — SELECT inventory FOR current
-- quantity, UPDATE with compare-and-swap, optional retry SELECT+UPDATE,
-- INSERT into stock_movements. An 8-item cart paid ~24 sequential
-- round-trips just for stock. At Sydney Vercel → Supabase Sydney ~5 ms
-- each that's ~120 ms on top of the other POS work.
--
-- After: one `pos_deduct_stock` call with the cart array as JSONB.
-- Runs inside the RPC's own transaction, per-row FOR UPDATE lock, all
-- UPDATEs + stock_movements INSERTs in the same DB round-trip. If any
-- item fails (insufficient stock, unknown item handled as skip to
-- match prior behavior) the function RAISEs and the whole RPC rolls
-- back — no partial deductions. The function returns the per-item
-- (inventory_id, original_qty) rows so the caller can build the
-- compensation record without a separate pre-read.

CREATE OR REPLACE FUNCTION public.pos_deduct_stock(
  p_tenant_id UUID,
  p_items JSONB,
  p_sale_number TEXT,
  p_user_id UUID
) RETURNS TABLE(inventory_id UUID, original_qty INTEGER, new_qty INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_inv_id UUID;
  v_qty INTEGER;
  v_name TEXT;
  v_old_qty INTEGER;
  v_new_qty INTEGER;
  v_db_name TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inv_id := (item->>'inventory_id')::UUID;
    v_qty := (item->>'quantity')::INTEGER;
    v_name := item->>'name';

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity|%', COALESCE(v_name, v_inv_id::TEXT)
        USING ERRCODE = '22023';
    END IF;

    SELECT quantity, name INTO v_old_qty, v_db_name
      FROM inventory
      WHERE id = v_inv_id AND tenant_id = p_tenant_id
      FOR UPDATE;

    IF NOT FOUND THEN
      -- Unknown / cross-tenant inventory id — silently skip to match the
      -- JS loop's prior behavior (it `continue`s on a missed select).
      CONTINUE;
    END IF;

    IF v_old_qty < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock|%|%',
        COALESCE(v_db_name, v_name, 'item'),
        v_old_qty
      USING ERRCODE = 'P0001';
    END IF;

    v_new_qty := v_old_qty - v_qty;

    UPDATE inventory
      SET quantity = v_new_qty
      WHERE id = v_inv_id AND tenant_id = p_tenant_id;

    INSERT INTO stock_movements (
      tenant_id, inventory_id, movement_type,
      quantity_change, quantity_after, notes, created_by
    ) VALUES (
      p_tenant_id, v_inv_id, 'sale',
      -v_qty, v_new_qty,
      'POS Sale ' || p_sale_number, p_user_id
    );

    inventory_id := v_inv_id;
    original_qty := v_old_qty;
    new_qty := v_new_qty;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_deduct_stock(UUID, JSONB, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_deduct_stock(UUID, JSONB, TEXT, UUID)
  TO service_role;

COMMENT ON FUNCTION public.pos_deduct_stock(UUID, JSONB, TEXT, UUID) IS
  'Atomically deducts stock + logs stock_movements for every item in a POS cart in a single transaction. Returns the (inventory_id, original_qty, new_qty) rows for caller-side compensation tracking. Raises insufficient_stock|<name>|<available> on any item that would go negative (whole tx rolls back). Service-role only.';
