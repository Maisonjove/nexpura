-- Revise pos_deduct_stock to be VALIDATION-ONLY.
--
-- Original v1 of this RPC (committed earlier today) did the row-lock
-- check, then UPDATE'd inventory.quantity AND inserted a row into
-- stock_movements. That triggered double-counting because the existing
-- trigger chain on sale_items already handles the actual deduction:
--   1. POSClient inserts sale_items
--   2. decrement_stock_on_sale trigger inserts a stock_movements row
--   3. sync_inventory_quantity trigger fires on that INSERT and
--      UPDATEs inventory.quantity by -1
--
-- v1 RPC added a SECOND stock_movements row (which fired sync again)
-- AND a direct UPDATE inventory.quantity, so a single sale of 1 unit
-- ended up deducting 3 from inventory. Confirmed end-to-end via the
-- jeweller-flow-pos.spec.ts test: seeded item went 50 → 47.
--
-- Fix: keep the FOR UPDATE row lock + insufficient-stock validation
-- (still useful so two concurrent terminals don't oversell — the lock
-- serialises them, and the RAISE rolls the whole transaction back
-- before any sale_items get inserted). Drop the UPDATE + INSERT.
-- The trigger chain already does both correctly when sale_items lands.

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

    -- FOR UPDATE row lock — serialises concurrent POS terminals trying
    -- to oversell the same SKU.
    SELECT quantity, name INTO v_old_qty, v_db_name
      FROM inventory
      WHERE id = v_inv_id AND tenant_id = p_tenant_id
      FOR UPDATE;

    IF NOT FOUND THEN
      -- Unknown / cross-tenant id — silently skip to match prior JS-loop
      -- behavior; sale_items insert will then have a NULL inventory_id
      -- and the trigger chain skips it too.
      CONTINUE;
    END IF;

    IF v_old_qty < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock|%|%',
        COALESCE(v_db_name, v_name, 'item'),
        v_old_qty
      USING ERRCODE = 'P0001';
    END IF;

    -- Return the validated row. Caller uses original_qty for the
    -- compensation list. new_qty is the value the trigger chain WILL
    -- write once sale_items lands — exposed for parity with the v1
    -- return shape but never applied here.
    inventory_id := v_inv_id;
    original_qty := v_old_qty;
    new_qty := v_old_qty - v_qty;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.pos_deduct_stock(UUID, JSONB, TEXT, UUID) IS
  'Validates POS cart against inventory, holding a FOR UPDATE row lock per item. Raises insufficient_stock|<name>|<available> on any item that would go negative. Returns (inventory_id, original_qty, new_qty) rows so the caller can record the pre-deduction state for compensation. Does NOT touch inventory.quantity or stock_movements — the existing decrement_stock_on_sale → sync_inventory_quantity trigger chain handles deduction when sale_items is inserted later in the saga.';
