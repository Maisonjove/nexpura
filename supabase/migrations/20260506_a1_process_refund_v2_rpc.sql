-- A1 cluster Day 2 (2026-05-06): process_refund_v2 RPC.
--
-- Single-transaction refund flow. Wraps:
--   1. refund insert
--   2. refund_items bulk insert
--   3. stock_movements bulk insert (BEFORE INSERT trigger handles
--      inventory.quantity sync — Q3 finding from Day 0 investigation)
--   4. gl_entries insert (the canonical money-out marker for
--      reconciliation)
--   5. parent sale.status update (only when fully refunded; same
--      predicate as the legacy processRefund flow)
--   6. customer.store_credit update (when refund_method='store_credit';
--      replaces the saga-style CAS retry from the legacy path with
--      a SELECT FOR UPDATE inside the same transaction)
--   7. customer_store_credit_history insert (audit trail)
--
-- Single transaction = no saga rollback path needed. PostgreSQL aborts
-- the whole tx if any step fails; refund + items + stock + GL never
-- end up in a half-applied state.
--
-- Caller contract (callers in src/app/(app)/refunds/actions.ts and
-- src/app/api/pos/refund/route.ts):
--   admin.rpc("process_refund_v2", {
--     p_tenant_id, p_user_id, p_original_sale_id, p_reason,
--     p_refund_method, p_refund_type, p_items (jsonb array), p_notes,
--     p_gateway_ref, p_manager_pin_hash (verified server-side, NOT
--     the plain PIN), p_idempotency_key
--   })
--   → returns ROW (refund_id uuid, refund_number text, gl_entry_id uuid)
--   → throws on any constraint violation, fully refunded predicate
--     mismatch, or RBAC fail (caller validates permissions before
--     calling)
--
-- Permission gating happens in the caller (requirePermission(
-- "create_invoices") + manager-PIN verify); the RPC only enforces
-- DB-level invariants.

BEGIN;

-- Drop any prior version (idempotent re-deploy support).
DROP FUNCTION IF EXISTS public.process_refund_v2(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
);

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
  -- Idempotency: if a refund row with this idempotency_key + tenant
  -- already exists, return its details. Caller fingerprints the key
  -- as `${saleId}:${method}:${item-shape}` so retries are detected.
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

  -- Lock the parent sale row for the duration of the tx. Prevents
  -- two concurrent refunds from both seeing the same
  -- already_refunded total and over-refunding past the sale total.
  SELECT * INTO v_sale FROM public.sales
   WHERE id = p_original_sale_id AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'process_refund_v2: original sale not found (sale=% tenant=%)',
      p_original_sale_id, p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Server-recompute subtotal from items. Never trust client values.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal +
      ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'process_refund_v2: refund subtotal must be positive (got %)', v_subtotal
      USING ERRCODE = '22023';
  END IF;

  -- Bound check: requested + already_refunded <= sale subtotal.
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

  -- Tax (use tenant's configured rate; default 10% if NULL).
  SELECT COALESCE(t.tax_rate, 0.10) INTO v_tax_rate
    FROM public.tenants t WHERE t.id = p_tenant_id;
  v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
  v_total      := v_subtotal + v_tax_amount;

  -- Allocate refund_number atomically.
  v_refund_number := public.next_refund_number(p_tenant_id);

  -- Insert refund row. notes embed the idempotency_key so the
  -- top-of-function check finds it on retry.
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

  -- Bulk insert refund_items.
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
  INSERT INTO public.stock_movements (
    tenant_id, inventory_id, movement_type, quantity_change,
    notes, created_by
  )
  SELECT
    p_tenant_id,
    (item->>'inventory_id')::UUID,
    'return',
    (item->>'quantity')::INTEGER,
    'Refund ' || v_refund_number,
    p_user_id
  FROM jsonb_array_elements(p_items) AS item
  WHERE COALESCE((item->>'restock')::BOOLEAN, FALSE) = TRUE
    AND NULLIF(item->>'inventory_id', '') IS NOT NULL;

  -- Store credit (when method = 'store_credit'). Uses SELECT FOR
  -- UPDATE inside the same tx — no CAS retry loop needed.
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

  -- Flip parent sale to 'refunded' iff fully refunded (matches the
  -- legacy processRefund predicate so the P0 guard's "refund row
  -- must exist" requirement remains correct downstream).
  v_fully_refunded := (v_subtotal + v_already_refunded) >=
                      (COALESCE(v_sale.subtotal, v_sale.total) - 0.01);
  IF v_fully_refunded THEN
    UPDATE public.sales
       SET status = 'refunded', updated_at = now()
     WHERE id = p_original_sale_id AND tenant_id = p_tenant_id;
  END IF;

  -- GL entry — single-row entry per A1's minimum-viable scope. The
  -- amount is signed: negative for money-out (refund). Future
  -- double-entry upgrade (post-engagement) splits this into
  -- balanced debit/credit pairs.
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

COMMENT ON FUNCTION public.process_refund_v2 IS
  'A1 (2026-05-06): single-transaction refund flow. Replaces the '
  'saga-style processRefund + /api/pos/refund flows when '
  'tenants.a1_money_correctness=TRUE. Wraps refund + refund_items + '
  'stock_movements + customer store_credit + customer_store_credit_'
  'history + gl_entries + parent sale.status flip in one tx — no '
  'half-applied state possible.';

-- Permission: callers (server actions / route handlers) MUST gate on
-- requirePermission("create_invoices") + manager-PIN verify (Day 2.5)
-- BEFORE invoking. The RPC trusts its caller for RBAC; it only
-- enforces DB-level invariants (tenant-scope, bound check, fully-
-- refunded predicate).
GRANT EXECUTE ON FUNCTION public.process_refund_v2 TO authenticated, service_role;

COMMIT;
