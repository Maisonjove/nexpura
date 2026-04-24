-- Launch-blocker remediations:
--
-- 1. audit_logs INSERT policy was `roles=public` with only a tenant match
--    — an authenticated anon-client can forge audit entries under any
--    user in its own tenant. Tighten to require user_id = auth.uid().
--
-- 2. users_insert_service / tenants_insert_service were `roles=public`
--    with no WITH CHECK — any signed-in JWT could create arbitrary rows.
--    Intent was service-role-only; restrict `roles` accordingly.
--
-- 3. Four tables had UPDATE policies with USING but no explicit WITH
--    CHECK. Postgres falls back to USING in that case so this isn't a
--    live hole, but it's defense-in-depth drift. Add explicit WITH
--    CHECK clauses matching USING.
--
-- 4. `refunds.refund_number` had no uniqueness constraint and the
--    `next_refund_number(p_tenant_id)` RPC didn't exist — code was
--    falling back to COUNT(*)+1, which races under concurrent refunds.
--    Two refunds posted within ~1ms of each other on the same tenant
--    could end up with the same R-XXXX number. Add the RPC + unique
--    constraint.

-- ──────────────────────────────────────────────────────────────────────
-- 1. audit_logs INSERT policy — drop the public-role policy entirely
-- ──────────────────────────────────────────────────────────────────────

-- `logAuditEvent` in src/lib/audit.ts writes via the admin (service-role)
-- Supabase client, so the existing authenticated-role policy is
-- unnecessary — service_role bypasses RLS. Dropping the public-role
-- policy closes the attack where an authenticated anon-client user
-- could forge audit entries under any teammate in their tenant.

DROP POLICY IF EXISTS audit_logs_insert_tenant ON public.audit_logs;

-- ──────────────────────────────────────────────────────────────────────
-- 2. users_insert_service / tenants_insert_service / subscriptions_insert_service
--    — service_role only
-- ──────────────────────────────────────────────────────────────────────

-- These policies were named "_service" but their `roles = {public}`
-- grant effectively exposed them to anon + authenticated. service_role
-- bypasses RLS anyway, so the policy is redundant for that role — but
-- dropping the public grant closes the exposure.
-- Subscriptions pubic INSERT was the worst — attacker could corrupt
-- any tenant's billing state (marking them past-due, forcing redirect
-- to /suspended, etc.).

DROP POLICY IF EXISTS users_insert_service ON public.users;
DROP POLICY IF EXISTS tenants_insert_service ON public.tenants;
DROP POLICY IF EXISTS subscriptions_insert_service ON public.subscriptions;

-- No replacement policies: INSERTs into users / tenants / subscriptions
-- happen via the admin (service-role) client in server code paths
-- (signup, invite accept, tenant creation, Stripe webhook). Service
-- role bypasses RLS by design.

-- order_attachments had an "ALL" policy with qual=true and
-- with_check=true on role public — effectively an anon-readable +
-- anon-writable table. Drop the broken policy; attachments are
-- managed through the authenticated (app) client which has a separate
-- tenant-scoped policy already.
DROP POLICY IF EXISTS "Service role full access attachments" ON public.order_attachments;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Explicit WITH CHECK on UPDATE/ALL policies that had only USING
-- ──────────────────────────────────────────────────────────────────────

-- purchase_orders.po_update (UPDATE, USING only)
ALTER POLICY po_update ON public.purchase_orders
  WITH CHECK (tenant_id = public.get_tenant_id());

-- refund_items.refund_items_tenant_isolation (ALL, USING only)
-- ALL covers SELECT+INSERT+UPDATE+DELETE. WITH CHECK applies to
-- INSERT+UPDATE only; Postgres already uses USING for SELECT+DELETE.
ALTER POLICY refund_items_tenant_isolation ON public.refund_items
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.refunds r
      WHERE r.id = refund_items.refund_id
        AND r.tenant_id = public.get_tenant_id()
    )
  );

-- stock_transfers.stock_transfers_tenant_isolation (ALL, USING only)
ALTER POLICY stock_transfers_tenant_isolation ON public.stock_transfers
  WITH CHECK (tenant_id = public.get_tenant_id());

-- stocktakes.stocktakes_tenant_isolation (ALL, USING only)
ALTER POLICY stocktakes_tenant_isolation ON public.stocktakes
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ──────────────────────────────────────────────────────────────────────
-- 4. refunds: uniqueness + atomic sequence
-- ──────────────────────────────────────────────────────────────────────

-- Guard against historical duplicates before adding the constraint.
-- If any exist we fail loud rather than silently dropping one.
DO $$
DECLARE
  v_dup_count integer;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT tenant_id, refund_number
    FROM public.refunds
    WHERE refund_number IS NOT NULL
    GROUP BY tenant_id, refund_number
    HAVING COUNT(*) > 1
  ) dups;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'refunds table has % duplicate (tenant_id, refund_number) pairs — resolve manually before adding unique constraint', v_dup_count;
  END IF;
END $$;

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_tenant_number_unique;

ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_tenant_number_unique UNIQUE (tenant_id, refund_number);

-- Atomic next_refund_number RPC. Pattern matches next_invoice_number /
-- next_sale_number. Advisory lock per-tenant serialises the increment,
-- then we scan for the current max and return max+1 formatted R-NNNN.
CREATE OR REPLACE FUNCTION public.next_refund_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
  v_num  text;
BEGIN
  -- Serialise concurrent callers for this tenant so two refunds
  -- can't both read max=N and both insert N+1.
  PERFORM pg_advisory_xact_lock(hashtext('refund_number:' || p_tenant_id::text));

  SELECT COALESCE(MAX(CAST(regexp_replace(refund_number, '[^0-9]', '', 'g') AS integer)), 0) + 1
    INTO v_next
    FROM public.refunds
    WHERE tenant_id = p_tenant_id
      AND refund_number ~ '^R-[0-9]+$';

  v_num := 'R-' || LPAD(v_next::text, 4, '0');
  RETURN v_num;
END;
$$;

REVOKE ALL ON FUNCTION public.next_refund_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_refund_number(uuid) TO service_role;
