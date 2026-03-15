-- 028_bespoke_repair_fixes.sql
-- Ensure bespoke_jobs has quoted_price and final_price columns
-- (the app code uses these names; the initial migration used estimated_cost/final_cost)
-- Also add stage column to repairs if missing (some code references repair.stage not repair.status)

ALTER TABLE public.bespoke_jobs
  ADD COLUMN IF NOT EXISTS quoted_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS final_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS stone_shape text,
  ADD COLUMN IF NOT EXISTS stone_clarity text,
  ADD COLUMN IF NOT EXISTS stone_origin text,
  ADD COLUMN IF NOT EXISTS stone_cert_number text,
  ADD COLUMN IF NOT EXISTS ring_size text,
  ADD COLUMN IF NOT EXISTS setting_style text;

-- repairs.stage (the form and detail client use .stage, not .status)
ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS stage text;

-- Back-fill stage from status if it exists
UPDATE public.repairs SET stage = status WHERE stage IS NULL AND status IS NOT NULL;
-- Default for any remaining
UPDATE public.repairs SET stage = 'intake' WHERE stage IS NULL;
