-- =====================================================
-- ALLOW NULL customer.full_name — 2026-04-20 (companion to ...trigger.sql)
-- =====================================================
--
-- Companion migration to 20260420_fix_customer_full_name_trigger.sql.
--
-- Problem: the fixed trigger correctly produces NULL when the caller
-- provides neither an explicit full_name nor first_name/last_name (per
-- the new precedence: explicit name wins, else compose, else NULL — no
-- invented "Customer" literal, no email-prefix leak). But the existing
-- `customers.full_name` column has a NOT NULL constraint, so those
-- nameless INSERTs now fail with code 23502 instead of landing cleanly.
--
-- Fix: drop the NOT NULL. A customer with no name information is a
-- legitimate edge case (walk-in with only a mobile number, import with
-- email-only contact, integration that sends a minimal record) and
-- should be representable. The UI should render "(No name)" when
-- full_name IS NULL — no database pollution.
-- =====================================================

ALTER TABLE customers
  ALTER COLUMN full_name DROP NOT NULL;

COMMENT ON COLUMN customers.full_name IS
  'Display name. Populated by the compute_customer_full_name() trigger from explicit input or first+last. NULL when no name info was provided at creation time — UI renders "(No name)" for these rows. Previously the trigger invented "Customer" or an email prefix to satisfy a NOT NULL constraint; that produced visible CRM pollution, so the constraint was dropped on 2026-04-20.';
