-- 012_fix_customer_columns.sql
-- Add missing columns to customers table

ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS ring_size text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_metal text,
  ADD COLUMN IF NOT EXISTS preferred_stone text;
