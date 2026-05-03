-- Phase 2 Group P2-B audit (Joey 2026-05-03): the embed appointment +
-- repair-enquiry endpoints have been silently 500'ing for the lifetime
-- of the feature. They INSERT into shop_enquiries with columns that
-- don't exist on the table:
--   appointment_type, preferred_date, preferred_time   (appointment endpoint)
--   item_description, issue_description                (repair-enquiry endpoint)
--
-- The /enquiries dashboard's TypeScript interface already declares
-- these fields and renders them in the detail view (EnquiriesClient.tsx
-- lines 14-18, 193-199). Schema drift between the table definition,
-- the dashboard reader, and the public-form writer.
--
-- Fix: add the missing columns. preferred_date is a date string from
-- <input type="date"> (always YYYY-MM-DD). The others are free-text
-- already bounded at the API layer (Zod validation on enquiry; raw
-- inputs on appointment + repair-enquiry — flagged separately).
--
-- Combined with the middleware /api/shop allowlist fix in the same PR,
-- this makes appointment + repair-enquiry actually save rows for the
-- first time.

ALTER TABLE shop_enquiries
  ADD COLUMN IF NOT EXISTS appointment_type TEXT,
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS item_description TEXT,
  ADD COLUMN IF NOT EXISTS issue_description TEXT;
