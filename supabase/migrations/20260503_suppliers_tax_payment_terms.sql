-- QA Group 7 — supplier form needs tax_id (ABN/ACN/EIN) + payment_terms.
-- Existing schema lacked both columns; the suppliers/new form had no UI
-- and /reports/suppliers tried to select payment_terms (returning null
-- for every row). Backfill empty strings on existing rows.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms text;
