-- =====================================================
-- ATOMIC next_sku — 2026-04-21
-- =====================================================
--
-- Previous next_sku() used:
--     SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 4) AS INT)), 0) + 1
--     FROM public.inventory WHERE tenant_id = p_tenant_id AND sku LIKE 'SKU%'
--
-- Not atomic: two concurrent callers see the same MAX and both return
-- the same number. The inventory_tenant_id_sku_unique partial index
-- catches the collision at insert time, so no duplicate lands — but
-- the loser gets a user-visible "duplicate key" error at exactly the
-- worst moment (intake form submit). At scale across several POS
-- terminals or a bulk import, this becomes a recurring intake-flow
-- failure.
--
-- Replacement matches the pattern already used by
-- next_sale_number / next_invoice_number / next_job_number /
-- next_repair_number — atomic UPDATE ... RETURNING on a counter
-- column stored on the tenants row. PostgreSQL serialises concurrent
-- UPDATEs of the same row via the row-level lock, so two callers
-- can never see the same counter.
--
-- Seed the new sku_sequence column to MAX(existing SKU number) for
-- every tenant so continuity is preserved: the next SKU issued after
-- this migration is one above whatever was the highest already in use.
-- =====================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS sku_sequence integer NOT NULL DEFAULT 0;

-- One-time seed: backfill sku_sequence to MAX(existing numeric SKU)
-- per tenant. Handles mixed-format SKUs safely: only numeric
-- SUBSTRING(sku FROM 4) values contribute. Runs once; idempotent on
-- re-run because GREATEST() guarantees monotonic climb.
UPDATE public.tenants t
SET sku_sequence = GREATEST(
  t.sku_sequence,
  COALESCE((
    SELECT MAX(
      CASE
        WHEN SUBSTRING(sku FROM 4) ~ '^[0-9]+$'
        THEN CAST(SUBSTRING(sku FROM 4) AS integer)
        ELSE 0
      END
    )
    FROM public.inventory i
    WHERE i.tenant_id = t.id
      AND i.sku LIKE 'SKU%'
  ), 0)
);

-- Atomic replacement RPC. Same signature (p_tenant_id uuid → text)
-- so the existing call sites in src/app/(app)/inventory/actions.ts
-- don't need to change.
CREATE OR REPLACE FUNCTION public.next_sku(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  UPDATE public.tenants
    SET sku_sequence = COALESCE(sku_sequence, 0) + 1
    WHERE id = p_tenant_id
    RETURNING sku_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  RETURN 'SKU' || LPAD(v_next::text, 5, '0');
END;
$$;

COMMENT ON FUNCTION public.next_sku(uuid) IS
  'Atomic next SKU. Uses UPDATE ... RETURNING on tenants.sku_sequence — row-level lock serialises concurrent callers so two POS terminals creating items simultaneously can never be handed the same number. Previous MAX+1 implementation was race-vulnerable; collisions caught by the partial UNIQUE index only after a user-facing error.';
