-- 031_intake_invoice_link.sql
-- Add invoice_id FK to repairs and bespoke_jobs tables
-- This allows direct linkage from job to invoice for the command center

-- Add invoice_id to repairs
ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repairs_invoice ON public.repairs(invoice_id);

-- Add invoice_id to bespoke_jobs  
ALTER TABLE public.bespoke_jobs
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bespoke_jobs_invoice ON public.bespoke_jobs(invoice_id);

-- Ensure invoices has amount_paid column
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) DEFAULT 0;
