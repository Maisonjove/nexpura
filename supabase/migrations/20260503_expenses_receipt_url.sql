-- QA Group 9 — expenses gain receipt_url so the form's receipt-upload
-- widget can persist a Supabase Storage URL alongside the row.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;
