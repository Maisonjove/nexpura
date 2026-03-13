-- 023_printer_multi.sql
-- Allow multiple printer configs per type per tenant

ALTER TABLE public.printer_configs DROP CONSTRAINT IF EXISTS printer_configs_tenant_id_printer_type_key;
ALTER TABLE public.printer_configs ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE public.printer_configs ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
