-- 026_numbering_sequences.sql
-- Add configurable number sequences to tenants table

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS invoice_sequence integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS job_sequence integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repair_sequence integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sale_sequence integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quote_sequence integer NOT NULL DEFAULT 1;

-- ============================================================
-- INVOICE NUMBERS
-- Uses GREATEST(MAX(existing numbers), invoice_sequence) so
-- the sequence can only move the counter forward, not reset it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_existing integer;
  v_sequence integer;
  v_next integer;
  v_number text;
BEGIN
  -- Get max number from existing invoices
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::integer),
    0
  )
  INTO v_max_existing
  FROM public.invoices
  WHERE tenant_id = p_tenant_id;

  -- Get configured sequence start
  SELECT invoice_sequence INTO v_sequence
  FROM public.tenants
  WHERE id = p_tenant_id;

  v_next := GREATEST(v_max_existing, COALESCE(v_sequence, 1) - 1) + 1;
  v_number := 'INV-' || LPAD(v_next::text, 4, '0');
  RETURN v_number;
END;
$$;

-- ============================================================
-- JOB NUMBERS (bespoke)
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_job_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_existing integer;
  v_sequence integer;
  v_next integer;
  v_number text;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(job_number, '[^0-9]', '', 'g'), '')::integer),
    0
  )
  INTO v_max_existing
  FROM public.bespoke_jobs
  WHERE tenant_id = p_tenant_id;

  SELECT job_sequence INTO v_sequence
  FROM public.tenants
  WHERE id = p_tenant_id;

  v_next := GREATEST(v_max_existing, COALESCE(v_sequence, 1) - 1) + 1;
  v_number := 'JOB-' || LPAD(v_next::text, 4, '0');
  RETURN v_number;
END;
$$;

-- ============================================================
-- REPAIR NUMBERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_repair_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_existing integer;
  v_sequence integer;
  v_next integer;
  v_number text;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(repair_number, '[^0-9]', '', 'g'), '')::integer),
    0
  )
  INTO v_max_existing
  FROM public.repairs
  WHERE tenant_id = p_tenant_id;

  SELECT repair_sequence INTO v_sequence
  FROM public.tenants
  WHERE id = p_tenant_id;

  v_next := GREATEST(v_max_existing, COALESCE(v_sequence, 1) - 1) + 1;
  v_number := 'REP-' || LPAD(v_next::text, 4, '0');
  RETURN v_number;
END;
$$;

-- ============================================================
-- SALE NUMBERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_sale_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_existing integer;
  v_sequence integer;
  v_next integer;
  v_number text;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(COALESCE(sale_number, ''), '[^0-9]', '', 'g'), '')::integer),
    0
  )
  INTO v_max_existing
  FROM public.sales
  WHERE tenant_id = p_tenant_id;

  SELECT sale_sequence INTO v_sequence
  FROM public.tenants
  WHERE id = p_tenant_id;

  v_next := GREATEST(v_max_existing, COALESCE(v_sequence, 1) - 1) + 1;
  v_number := 'SALE-' || LPAD(v_next::text, 4, '0');
  RETURN v_number;
END;
$$;

-- ============================================================
-- QUOTE NUMBERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_quote_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_existing integer;
  v_sequence integer;
  v_next integer;
  v_number text;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(COALESCE(quote_number, ''), '[^0-9]', '', 'g'), '')::integer),
    0
  )
  INTO v_max_existing
  FROM public.quotes
  WHERE tenant_id = p_tenant_id;

  SELECT quote_sequence INTO v_sequence
  FROM public.tenants
  WHERE id = p_tenant_id;

  v_next := GREATEST(v_max_existing, COALESCE(v_sequence, 1) - 1) + 1;
  v_number := 'QUO-' || LPAD(v_next::text, 4, '0');
  RETURN v_number;
END;
$$;
