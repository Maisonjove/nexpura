-- ============================================================================
-- ATOMIC SEQUENCES MIGRATION
-- Replaces MAX()-based number generation with atomic UPDATE+RETURNING
-- to eliminate race conditions when multiple concurrent requests try to
-- generate the next document number.
-- ============================================================================

-- Generic atomic increment function
CREATE OR REPLACE FUNCTION public.increment_sequence(
  p_tenant_id UUID,
  p_sequence_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
  v_column TEXT;
BEGIN
  v_column := p_sequence_type || '_sequence';

  EXECUTE format(
    'UPDATE public.tenants SET %I = COALESCE(%I, 0) + 1 WHERE id = $1 RETURNING %I',
    v_column, v_column, v_column
  ) INTO v_next USING p_tenant_id;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found or column % missing', p_tenant_id, v_column;
  END IF;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INVOICE NUMBERS — atomic, no MAX()
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_prefix text;
BEGIN
  -- Atomic increment
  UPDATE public.tenants
  SET invoice_sequence = COALESCE(invoice_sequence, 0) + 1
  WHERE id = p_tenant_id
  RETURNING invoice_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  -- Get optional prefix
  SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix
  FROM public.tenants WHERE id = p_tenant_id;

  RETURN v_prefix || LPAD(v_next::text, 4, '0');
END;
$$;

-- ============================================================
-- JOB NUMBERS (bespoke) — atomic, no MAX()
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_job_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_prefix text;
BEGIN
  UPDATE public.tenants
  SET job_sequence = COALESCE(job_sequence, 0) + 1
  WHERE id = p_tenant_id
  RETURNING job_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  SELECT COALESCE(job_prefix, 'JOB-') INTO v_prefix
  FROM public.tenants WHERE id = p_tenant_id;

  RETURN v_prefix || LPAD(v_next::text, 4, '0');
END;
$$;

-- ============================================================
-- REPAIR NUMBERS — atomic, no MAX()
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_repair_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_prefix text;
BEGIN
  UPDATE public.tenants
  SET repair_sequence = COALESCE(repair_sequence, 0) + 1
  WHERE id = p_tenant_id
  RETURNING repair_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  SELECT COALESCE(repair_prefix, 'REP-') INTO v_prefix
  FROM public.tenants WHERE id = p_tenant_id;

  RETURN v_prefix || LPAD(v_next::text, 4, '0');
END;
$$;

-- ============================================================
-- SALE NUMBERS — atomic, no MAX()
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_sale_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_prefix text;
BEGIN
  UPDATE public.tenants
  SET sale_sequence = COALESCE(sale_sequence, 0) + 1
  WHERE id = p_tenant_id
  RETURNING sale_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  SELECT COALESCE(sale_prefix, 'SALE-') INTO v_prefix
  FROM public.tenants WHERE id = p_tenant_id;

  RETURN v_prefix || LPAD(v_next::text, 4, '0');
END;
$$;

-- ============================================================
-- QUOTE NUMBERS — atomic, no MAX()
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_quote_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
  v_prefix text;
BEGIN
  UPDATE public.tenants
  SET quote_sequence = COALESCE(quote_sequence, 0) + 1
  WHERE id = p_tenant_id
  RETURNING quote_sequence INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  SELECT COALESCE(quote_prefix, 'QUO-') INTO v_prefix
  FROM public.tenants WHERE id = p_tenant_id;

  RETURN v_prefix || LPAD(v_next::text, 4, '0');
END;
$$;

-- ============================================================
-- MEDIUM FIX 3: Ensure sequence columns exist & add unique constraints
-- ============================================================

-- Add sequence columns if missing (already added in 026, but be safe)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS invoice_sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sale_sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS repair_sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS quote_sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS job_sequence INTEGER NOT NULL DEFAULT 0;

-- Sync sequences to current max so we don't duplicate existing numbers
UPDATE public.tenants t
SET invoice_sequence = GREATEST(
  COALESCE(t.invoice_sequence, 0),
  COALESCE((
    SELECT MAX(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::integer)
    FROM public.invoices WHERE tenant_id = t.id
  ), 0)
);

UPDATE public.tenants t
SET sale_sequence = GREATEST(
  COALESCE(t.sale_sequence, 0),
  COALESCE((
    SELECT MAX(NULLIF(regexp_replace(COALESCE(sale_number, ''), '[^0-9]', '', 'g'), '')::integer)
    FROM public.sales WHERE tenant_id = t.id
  ), 0)
);

UPDATE public.tenants t
SET repair_sequence = GREATEST(
  COALESCE(t.repair_sequence, 0),
  COALESCE((
    SELECT MAX(NULLIF(regexp_replace(repair_number, '[^0-9]', '', 'g'), '')::integer)
    FROM public.repairs WHERE tenant_id = t.id
  ), 0)
);

UPDATE public.tenants t
SET quote_sequence = GREATEST(
  COALESCE(t.quote_sequence, 0),
  COALESCE((
    SELECT MAX(NULLIF(regexp_replace(COALESCE(quote_number, ''), '[^0-9]', '', 'g'), '')::integer)
    FROM public.quotes WHERE tenant_id = t.id
  ), 0)
);

UPDATE public.tenants t
SET job_sequence = GREATEST(
  COALESCE(t.job_sequence, 0),
  COALESCE((
    SELECT MAX(NULLIF(regexp_replace(COALESCE(job_number, ''), '[^0-9]', '', 'g'), '')::integer)
    FROM public.bespoke_jobs WHERE tenant_id = t.id
  ), 0)
);

-- Unique constraints per tenant to catch any duplicates at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_number ON public.invoices(tenant_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_number ON public.sales(tenant_id, sale_number) WHERE sale_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_repairs_tenant_number ON public.repairs(tenant_id, repair_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_tenant_number ON public.quotes(tenant_id, quote_number) WHERE quote_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bespoke_tenant_number ON public.bespoke_jobs(tenant_id, job_number) WHERE job_number IS NOT NULL;
