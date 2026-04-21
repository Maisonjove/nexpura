-- =====================================================
-- Concurrency-safe store credit + voucher redemption
-- Audit finding (High): POS deducts using optimistic compare-and-swap.
-- Two concurrent terminal sales for the same customer/voucher can
-- both pass the CAS and leave the balance negative or double-redeem.
--
-- Fix: move both decrements to DB-side functions that:
--   1. SELECT FOR UPDATE (row-level lock)
--   2. verify the requested amount fits
--   3. UPDATE with the decremented value in the same transaction
-- Plus a CHECK constraint on customers.store_credit >= 0 as a
-- belt-and-suspenders guard against any direct writes that skip the
-- function.
--
-- Callers swap from their current CAS loop to SELECT on rpc(). Any
-- existing negative balances (if there are any) are bumped to 0
-- before the CHECK is added so the migration doesn't fail.
-- =====================================================

-- 1. Clean any pre-existing negative store credit before adding CHECK.
UPDATE public.customers
  SET store_credit = 0
  WHERE COALESCE(store_credit, 0) < 0;

-- 2. CHECK constraint: balance cannot go negative via any path.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_store_credit_nonneg;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_store_credit_nonneg
  CHECK (COALESCE(store_credit, 0) >= 0);

-- 3. Atomic deduct function. SECURITY DEFINER so it runs with owner
-- privileges regardless of the caller's role (needed because
-- createAdminClient uses service_role but this is also safe to call
-- from SQL-triggered contexts).
CREATE OR REPLACE FUNCTION public.deduct_store_credit(
  p_customer_id uuid,
  p_tenant_id uuid,
  p_amount numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current numeric;
  v_new numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  -- Row lock: any concurrent deduct_store_credit for the same customer
  -- waits here, guaranteeing serialised balance math.
  SELECT store_credit INTO v_current
    FROM customers
    WHERE id = p_customer_id AND tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_current, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_store_credit' USING ERRCODE = 'P0001';
  END IF;

  v_new := COALESCE(v_current, 0) - p_amount;
  UPDATE customers SET store_credit = v_new, updated_at = now()
    WHERE id = p_customer_id AND tenant_id = p_tenant_id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_store_credit(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_store_credit(uuid, uuid, numeric) TO service_role;

COMMENT ON FUNCTION public.deduct_store_credit(uuid, uuid, numeric) IS
  'Atomically deduct store credit with row-lock + balance check. Throws insufficient_store_credit / customer_not_found / invalid_amount on failure. Service-role only.';

-- 4. Atomic voucher redemption. Same shape. Prevents double-redeem.
CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_voucher_id uuid,
  p_tenant_id uuid,
  p_amount numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_status text;
  v_new numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  SELECT balance, status INTO v_balance, v_status
    FROM gift_vouchers
    WHERE id = p_voucher_id AND tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voucher_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'voucher_not_active' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_voucher_balance' USING ERRCODE = 'P0001';
  END IF;

  v_new := COALESCE(v_balance, 0) - p_amount;
  UPDATE gift_vouchers
    SET balance = v_new,
        status = CASE WHEN v_new <= 0 THEN 'redeemed' ELSE 'active' END,
        updated_at = now()
    WHERE id = p_voucher_id AND tenant_id = p_tenant_id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, numeric) TO service_role;

COMMENT ON FUNCTION public.redeem_voucher(uuid, uuid, numeric) IS
  'Atomically redeem voucher amount with row-lock. Rejects if not active, not found, or insufficient balance. Flips status to redeemed when balance hits zero.';
