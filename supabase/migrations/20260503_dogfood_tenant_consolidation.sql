-- Phase 1.5 post-audit (Joey 2026-05-03): consolidate the dogfood
-- tenant + categorize the 4 ambiguous active subs.
--
-- Architectural decision: the multi-tenant "free forever" pattern
-- is removed in favour of two states:
--   1. Extended trial — subscription.status='trialing' with a forward-
--      dated trial_ends_at; converts to paid via Stripe checkout when
--      the trial expires, OR auto-suspends if no card.
--   2. Cancelled / inactive.
--
-- The ONE exception is hello@nexpura.com's tenant (the canonical
-- Nexpura dogfood tenant): is_free_forever=true is allowed there only.
-- Enforced by CHECK constraint at the bottom of this migration.
--
-- Migration steps (all idempotent on re-run):
--   1. Rename slug "test8" → "nexpura" on the dogfood tenant.
--   2. Soft-delete tenant 25841dae (test 4) and the older
--      a1b2c3d4...nexpura-hq tenant.
--   3. NULL out germanijoey@yahoo.com's tenant_id so the user can
--      route to /admin (allowlisted) instead of /dashboard.
--   4. Flip the 3 remaining ambiguous active subs (Astry/Marcus/Jack)
--      to status='trialing' with trial_ends_at = NOW() + 3 months.
--   5. Soft-delete the test 4 subscription (no longer active for a
--      soft-deleted tenant).
--   6. Drop subscriptions.is_admin_gifted column (zero app-code refs;
--      only ever read in the original migration that added it).
--   7. CHECK constraint: is_free_forever=true allowed only on
--      316a3313 (the canonical Nexpura tenant).

BEGIN;

-- ─── 1. slug rename ────────────────────────────────────────────────
UPDATE tenants
   SET slug = 'nexpura'
 WHERE id = '316a3313-d4fe-4dc8-8ad6-86a11f0f0209'
   AND slug = 'test8';

-- ─── 2. soft-delete test 4 + Nexpura HQ ────────────────────────────
UPDATE tenants
   SET deleted_at = NOW()
 WHERE id IN (
         '25841dae-5124-4206-8c55-d05fd4e28d3c',  -- test 4
         'a1b2c3d4-e5f6-7890-abcd-ef1234567890'   -- Nexpura HQ (older seed)
       )
   AND deleted_at IS NULL;

-- ─── 3. detach germanijoey@yahoo.com from the soft-deleted tenant ──
-- The user becomes platform-admin-only (allowlisted in src/lib/admin-
-- allowlist.ts + present in super_admins). Post-login routing in
-- /api/auth/login + middleware redirects allowlisted-no-tenant users
-- straight to /admin.
UPDATE users
   SET tenant_id = NULL
 WHERE email = 'germanijoey@yahoo.com'
   AND tenant_id = '25841dae-5124-4206-8c55-d05fd4e28d3c';

-- ─── 4. flip the 3 admin-set "active" subs to extended trial ───────
-- Pre-fix these were marked status='active' with vague far-out
-- current_period_end dates and no Stripe linkage — silently
-- contributing to MRR while not actually paying. Trialing is the
-- correct state: when the trial expires, Stripe checkout converts
-- them to paid OR auto-suspend kicks in.
UPDATE subscriptions
   SET status = 'trialing',
       trial_ends_at = NOW() + INTERVAL '3 months',
       updated_at = NOW()
 WHERE tenant_id IN (
         '13af701f-21af-4a8c-86db-7f3885398897',  -- Astry
         '0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a',  -- Marcus & Co
         '034931a3-6c6d-4063-8517-8e4767c780ba'   -- Jack Jewellery
       )
   AND status = 'active';

-- ─── 5. test 4's subscription — its tenant is soft-deleted, mark
--      canceled so the active-subs query no longer surfaces it.
--      (Schema uses American spelling — subscriptions_status_check
--      enforces the canonical 'canceled', not the British 'cancelled'.)
UPDATE subscriptions
   SET status = 'canceled',
       updated_at = NOW()
 WHERE tenant_id = '25841dae-5124-4206-8c55-d05fd4e28d3c'
   AND status IN ('active', 'trialing');

-- ─── 6. drop is_admin_gifted ──────────────────────────────────────
ALTER TABLE subscriptions DROP COLUMN IF EXISTS is_admin_gifted;

-- ─── 7. align is_free_forever with the new single-tenant policy ────
-- Pre-migration there's exactly one tenant flagged is_free_forever=true
-- that ISN'T the dogfood tenant: the "Test" tenant 5400f9c2 owned by
-- joeygermani11@icloud.com. Flip it false so the CHECK constraint
-- below can be added without violating any existing row. The dogfood
-- tenant gets the flag affirmatively so the secondary belt-and-
-- suspenders MRR-exclusion path (calculateMRRByCurrency falls back to
-- is_free_forever when tenant_id doesn't match the canonical id —
-- e.g. legacy callers that don't pass tenants map) keeps working.
UPDATE tenants
   SET is_free_forever = false
 WHERE id != '316a3313-d4fe-4dc8-8ad6-86a11f0f0209'
   AND is_free_forever = true;
UPDATE tenants
   SET is_free_forever = true
 WHERE id = '316a3313-d4fe-4dc8-8ad6-86a11f0f0209'
   AND is_free_forever = false;

-- ─── 8. CHECK constraint on tenants.is_free_forever ────────────────
-- The dogfood tenant is the only row allowed to have
-- is_free_forever=true. Any future attempt to flip another tenant
-- (admin script, manual tweak, RPC call) gets rejected at the DB
-- layer regardless of who's writing.
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS free_forever_dogfood_only;
ALTER TABLE tenants
  ADD CONSTRAINT free_forever_dogfood_only
  CHECK (
    is_free_forever = false
    OR id = '316a3313-d4fe-4dc8-8ad6-86a11f0f0209'
  );

COMMIT;
