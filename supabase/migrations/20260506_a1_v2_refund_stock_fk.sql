-- A1 followup cluster, item 9 (2026-05-06):
-- process_refund_v2 must populate stock_movements.reference_type +
-- reference_id when emitting return-to-stock rows.
--
-- Q3 instrumentation gap (Day 0 investigation, surfaced in R5 retest):
--   The RPC writes notes='Refund R-XXXX' but leaves reference_type=NULL,
--   reference_id=NULL on the stock_movements row. That makes it
--   impossible to FK-join from a stock_movements row back to its
--   originating refund row programmatically — must parse the notes
--   string. The legacy decrement_stock_on_sale trigger on sale_items
--   sets reference_type='sale_item', reference_id=NEW.id; v2's
--   restock-on-refund path needs the analogous coverage.
--
-- Fix:
--   CREATE OR REPLACE the RPC body. Only the stock_movements INSERT
--   changes — every other behaviour (idempotency, locking, GL,
--   customer credit, fully-refunded predicate) is byte-identical to
--   the prior version (20260506_a1_process_refund_v2_rpc.sql).
--
-- Verification (post-apply):
--   Trigger a small refund on a synthetic test sale and confirm the
--   stock_movements row written by the v2 path has
--   reference_type='refund' and reference_id=<refund_id> populated.
--   Documented in PR description.

BEGIN;

CREATE OR REPLACE FUNCTION public.process_refund_v2(
  p_tenant_id          UUID,
  p_user_id            UUID,
  p_original_sale_id   UUID,
  p_reason             TEXT,
  p_refund_method      TEXT,
  p_refund_type        TEXT,
  p_items              JSONB,
  p_notes              TEXT,
  p_gateway_ref        TEXT,
  p_idempotency_key    TEXT
) RETURNS TABLE (
  refund_id     UUID,
  refund_number TEXT,
  gl_entry_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund_id           UUID;
  v_refund_number       TEXT;
  v_gl_entry_id         UUID;
  v_sale                public.sales%ROWTYPE;
  v_subtotal            NUMERIC(14,2) := 0;
  v_tax_rate            NUMERIC(6,5);
  v_tax_amount          NUMERIC(14,2);
  v_total               NUMERIC(14,2);
  v_already_refunded    NUMERIC(14,2);
  v_remaining           NUMERIC(14,2);
  v_fully_refunded      BOOLEAN;
  v_item                JSONB;
  v_old_credit          NUMERIC(14,2);
BEGIN
  -- Idempotency.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT r.id, r.refund_number INTO v_refund_id, v_refund_number
      FROM public.refunds r
     WHERE r.tenant_id = p_tenant_id
       AND r.notes LIKE '%idem:' || p_idempotency_key || '%'
     LIMIT 1;
    IF v_refund_id IS NOT NULL THEN
      SELECT g.id INTO v_gl_entry_id
        FROM public.gl_entries g
       WHERE g.tenant_id = p_tenant_id
         AND g.source_type = 'refund'
         AND g.source_id = v_refund_id
       LIMIT 1;
      RETURN QUERY SELECT v_refund_id, v_refund_number, v_gl_entry_id;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_sale FROM public.sales
   WHERE id = p_original_sale_id AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_refund_v2: original sale not found (sale=% tenant=%)',
      p_original_sale_id, p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal +
      ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'process_refund_v2: refund subtotal must be positive (got %)', v_subtotal
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(r.total), 0) INTO v_already_refunded
    FROM public.refunds r
   WHERE r.tenant_id = p_tenant_id
     AND r.original_sale_id = p_original_sale_id;
  v_remaining := COALESCE(v_sale.subtotal, v_sale.total) - v_already_refunded;
  IF v_subtotal > v_remaining + 0.01 THEN
    RAISE EXCEPTION
      'process_refund_v2: refund exceeds remaining refundable (sale_subtotal=% already=% remaining=% requested=%)',
      v_sale.subtotal, v_already_refunded, v_remaining, v_subtotal
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(t.tax_rate, 0.10) INTO v_tax_rate
    FROM public.tenants t WHERE t.id = p_tenant_id;
  v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
  v_total      := v_subtotal + v_tax_amount;

  v_refund_number := public.next_refund_number(p_tenant_id);

  INSERT INTO public.refunds (
    tenant_id, refund_number, original_sale_id,
    customer_id, customer_name, customer_email,
    reason, refund_method, refund_type,
    subtotal, tax_amount, total,
    notes, status, processed_by,
    gateway_ref, completed_at
  ) VALUES (
    p_tenant_id, v_refund_number, p_original_sale_id,
    v_sale.customer_id, v_sale.customer_name, v_sale.customer_email,
    p_reason, p_refund_method, p_refund_type,
    v_subtotal, v_tax_amount, v_total,
    COALESCE(p_notes, '') ||
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN ' [idem:' || p_idempotency_key || ']'
           ELSE '' END,
    'completed', p_user_id,
    p_gateway_ref, now()
  ) RETURNING id INTO v_refund_id;

  INSERT INTO public.refund_items (
    tenant_id, refund_id, original_sale_item_id, inventory_id,
    description, quantity, unit_price, line_total, restock
  )
  SELECT
    p_tenant_id, v_refund_id,
    NULLIF(item->>'original_sale_item_id', '')::UUID,
    NULLIF(item->>'inventory_id', '')::UUID,
    item->>'description',
    (item->>'quantity')::INTEGER,
    (item->>'unit_price')::NUMERIC(12,2),
    (item->>'quantity')::NUMERIC * (item->>'unit_price')::NUMERIC,
    COALESCE((item->>'restock')::BOOLEAN, FALSE)
  FROM jsonb_array_elements(p_items) AS item;

  -- Stock movements for restocked items.
  -- ITEM 9 FIX: populate reference_type + reference_id so a
  -- stock_movements row can be FK-joined back to its originating refund
  -- without parsing the notes string. Mirrors the legacy
  -- decrement_stock_on_sale trigger pattern (reference_type='sale_item',
  -- reference_id=NEW.id) for symmetry.
  INSERT INTO public.stock_movements (
    tenant_id, inventory_id, movement_type, quantity_change,
    reference_type, reference_id,
    notes, created_by
  )
  SELECT
    p_tenant_id,
    (item->>'inventory_id')::UUID,
    'return',
    (item->>'quantity')::INTEGER,
    'refund', v_refund_id,
    'Refund ' || v_refund_number,
    p_user_id
  FROM jsonb_array_elements(p_items) AS item
  WHERE COALESCE((item->>'restock')::BOOLEAN, FALSE) = TRUE
    AND NULLIF(item->>'inventory_id', '') IS NOT NULL;

  IF p_refund_method = 'store_credit' AND v_sale.customer_id IS NOT NULL THEN
    SELECT c.store_credit INTO v_old_credit
      FROM public.customers c
     WHERE c.id = v_sale.customer_id AND c.tenant_id = p_tenant_id
     FOR UPDATE;
    UPDATE public.customers
       SET store_credit = COALESCE(v_old_credit, 0) + v_total,
           updated_at = now()
     WHERE id = v_sale.customer_id AND tenant_id = p_tenant_id;
    INSERT INTO public.customer_store_credit_history (
      tenant_id, customer_id, amount, reason, sale_id, refund_id, created_by
    ) VALUES (
      p_tenant_id, v_sale.customer_id, v_total, 'Refund',
      v_sale.id, v_refund_id, p_user_id
    );
  END IF;

  v_fully_refunded := (v_subtotal + v_already_refunded) >=
                      (COALESCE(v_sale.subtotal, v_sale.total) - 0.01);
  IF v_fully_refunded THEN
    UPDATE public.sales
       SET status = 'refunded', updated_at = now()
     WHERE id = p_original_sale_id AND tenant_id = p_tenant_id;
  END IF;

  INSERT INTO public.gl_entries (
    tenant_id, entry_type, amount, currency,
    source_type, source_id, notes, created_by
  ) VALUES (
    p_tenant_id, 'refund', -v_total,
    COALESCE((SELECT t.currency FROM public.tenants t WHERE t.id = p_tenant_id), 'AUD'),
    'refund', v_refund_id,
    'Refund ' || v_refund_number,
    p_user_id
  ) RETURNING id INTO v_gl_entry_id;

  RETURN QUERY SELECT v_refund_id, v_refund_number, v_gl_entry_id;
END;
$$;

COMMIT;
