-- ============================================================
-- INTEGRATIONS TABLE + COLUMNS
-- Supports: xero, whatsapp, shopify, insurance
-- ============================================================

-- Main integrations table
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('xero', 'whatsapp', 'shopify', 'insurance')),
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique per tenant per type
CREATE UNIQUE INDEX IF NOT EXISTS integrations_tenant_type_idx
  ON public.integrations (tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON public.integrations(tenant_id);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integrations' AND policyname = 'integrations_tenant'
  ) THEN
    CREATE POLICY "integrations_tenant" ON public.integrations
      USING (tenant_id = public.get_tenant_id())
      WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add xero_invoice_id to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS xero_invoice_id text;

-- Add shopify_product_id to inventory table
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS shopify_product_id text,
  ADD COLUMN IF NOT EXISTS shopify_synced_at timestamptz;
