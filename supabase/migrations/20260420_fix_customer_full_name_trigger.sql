-- =====================================================
-- FIX CUSTOMER FULL_NAME TRIGGER — 2026-04-20
-- =====================================================
--
-- Supersedes the trigger function installed on 2026-04-01
-- (20260401_fix_audit_and_customer_bugs.sql §2).
--
-- Original behaviour (broken):
--   * Always rebuilt full_name from first_name + last_name on INSERT / UPDATE.
--   * Fell back to SPLIT_PART(email, '@', 1) if first+last were empty.
--   * Fell back to the literal string 'Customer' if email was also NULL.
--   * Explicit full_name supplied by the caller was silently discarded.
--
-- Visible production consequences on real tenants:
--   * Customers created via any path that supplied `full_name` but not
--     first_name/last_name (imports, integrations, single-field CRM sync)
--     ended up with full_name = email-local-part (e.g. "loadtest1",
--     "gamma.qa"), or the literal word "Customer" when email was also
--     absent. Live QA on the test-4 tenant confirmed 3+ rows literally
--     named "Customer".
--
-- Fixed behaviour:
--   1. On INSERT: preserve the caller's explicit `full_name` when it is
--      non-null and non-blank. Otherwise compose from first+last. Otherwise
--      leave NULL — no more invented "Customer" fallback, no more email-
--      prefix leaks.
--   2. On UPDATE:
--       * If the caller changed `full_name` to a non-empty value, honour it.
--       * Else if first_name or last_name changed, recompose full_name from
--         the new parts (prevents stale full_name after direct first/last
--         edits that bypass the app's updateCustomer action).
--       * Otherwise leave `full_name` untouched.
-- =====================================================

CREATE OR REPLACE FUNCTION compute_customer_full_name()
RETURNS TRIGGER AS $$
DECLARE
  composed TEXT;
BEGIN
  composed := NULLIF(
    TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')),
    ''
  );

  IF TG_OP = 'INSERT' THEN
    -- Trust explicit full_name; else compose; else leave NULL.
    IF NEW.full_name IS NOT NULL AND TRIM(NEW.full_name) <> '' THEN
      NEW.full_name := TRIM(NEW.full_name);
    ELSE
      NEW.full_name := composed;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path.
  IF COALESCE(NEW.full_name, '') IS DISTINCT FROM COALESCE(OLD.full_name, '')
     AND NEW.full_name IS NOT NULL
     AND TRIM(NEW.full_name) <> '' THEN
    -- Caller explicitly set full_name in this UPDATE — honour their value.
    NEW.full_name := TRIM(NEW.full_name);
  ELSIF COALESCE(NEW.first_name, '') IS DISTINCT FROM COALESCE(OLD.first_name, '')
     OR COALESCE(NEW.last_name, '') IS DISTINCT FROM COALESCE(OLD.last_name, '') THEN
    -- First/last changed but caller didn't also set full_name — recompose so
    -- a stale full_name doesn't persist past an edit that touches only the
    -- name parts. Fall back to any still-present full_name, finally NULL.
    IF composed IS NOT NULL THEN
      NEW.full_name := composed;
    ELSIF NEW.full_name IS NOT NULL AND TRIM(NEW.full_name) <> '' THEN
      NEW.full_name := TRIM(NEW.full_name);
    ELSE
      NEW.full_name := NULL;
    END IF;
  END IF;
  -- If nothing relevant changed, NEW.full_name is left as-is.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger definition from 20260401 already points at this function
-- name (BEFORE INSERT OR UPDATE OF first_name, last_name, email ON customers)
-- — replacing the function body picks up the new logic without needing to
-- re-create the trigger itself. Kept the same firing condition: trigger
-- still only runs when first_name / last_name / email change, so plain
-- full_name-only updates pass through untouched (which is exactly what we
-- want — an explicit full_name UPDATE should always be honoured as-is).

COMMENT ON FUNCTION compute_customer_full_name() IS
  'Auto-composes full_name from first_name + last_name when the caller did not provide one explicitly. Preserves explicit full_name values. Final fallback is NULL (never the literal "Customer" or email local-parts). Replaces the 2026-04-01 version.';

-- =====================================================
-- Note on existing rows
-- =====================================================
-- This migration does NOT mutate existing customer rows. Two pollution
-- shapes from the old trigger are known to exist on production tenants:
--
--   (a) rows where full_name = 'Customer' and first_name/last_name/email
--       are all NULL. These are unambiguously trigger-generated and safe
--       to set to NULL.
--
--   (b) rows where full_name = SPLIT_PART(email, '@', 1) and
--       first_name/last_name are NULL. These are ambiguous — a real
--       customer's name might coincidentally match an email prefix — so
--       automatic repair is not safe.
--
-- If you want the (a) rows cleaned up, run (scoped to your tenant):
--
--   UPDATE customers
--   SET    full_name = NULL
--   WHERE  tenant_id = '<your-tenant-id>'
--     AND  full_name = 'Customer'
--     AND  first_name IS NULL
--     AND  last_name  IS NULL
--     AND  email      IS NULL
--     AND  deleted_at IS NULL;
--
-- The (b) rows are left to jeweller-driven cleanup via the UI.
