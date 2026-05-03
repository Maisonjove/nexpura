-- tenants RLS hardening — Group 15 audit (P0 cross-tenant data leak).
--
-- TWO defective policies surfaced during the prod RLS probe pass:
--
-- 1. `tenants_authenticated_only` had qual `(auth.role() = 'authenticated')`
--    and no tenant scoping at all. PostgREST returned EVERY tenants row to
--    any authenticated user — every customer's business_name, ABN, address,
--    currency, tax_rate, business_type, contact phone/email/website was
--    visible to every other customer's logged-in user. Verified live:
--    `GET /rest/v1/tenants?select=id,name,currency` as Joey (tenant 25841dae)
--    returned Astry, Heritage Jewellers, Milano Oro, Sakura Gems, Nordic Gold,
--    Riviera Bijoux, Amazon Stones, etc. The encrypted bank columns are
--    encrypted-at-rest so those don't leak in cleartext, but everything else
--    on the tenants row was a free read.
--
--    Why this happened: in supabase RLS, multiple permissive policies on the
--    same command are OR'd together, so the broader `auth.role() = authenticated`
--    policy completely shadowed the narrower `tenants_select_own (id = get_tenant_id())`
--    policy. If you can read for ANY reason that any policy allows, you can
--    read.
--
-- 2. `Tenant members can update their own tenant` allowed any row in
--    team_members with the user_id+tenant_id match to update the tenants
--    row — no role check. A staff user (not owner, not manager) hitting
--    PostgREST directly with their session token could update business_name,
--    currency, tax_rate, banking encryption fields, etc., bypassing the
--    `tenants_update_owner` role gate that's OR'd with it. The application-
--    layer actions (saveBusinessProfile, saveTaxCurrency, saveBanking) all
--    correctly call requireRole — but RLS is meant to be defence-in-depth
--    for any direct REST hits that skip the app.
--
-- Fix:
--   - Drop `tenants_authenticated_only` outright. The narrower
--     `tenants_select_own (id = get_tenant_id())` already covers the
--     legitimate self-read.
--   - Drop `Tenant members can update their own tenant`. The narrower
--     `tenants_update_owner` (id = get_tenant_id() AND get_user_role() = 'owner')
--     is the intended gate.
--
-- After this migration the only policies on tenants are:
--   SELECT: tenants_select_own (own tenant only)
--   UPDATE: tenants_update_owner (own tenant + owner role)
-- INSERT/DELETE: not tenant-self-managed; ops via service-role only.

DROP POLICY IF EXISTS "tenants_authenticated_only" ON tenants;
DROP POLICY IF EXISTS "Tenant members can update their own tenant" ON tenants;

-- Verify the surviving policies still cover the legitimate self-read +
-- owner-only-update cases. Defensive — recreate if missing (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tenants_select_own' AND polrelid = 'public.tenants'::regclass) THEN
    CREATE POLICY tenants_select_own ON tenants
      FOR SELECT
      USING (id = get_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tenants_update_owner' AND polrelid = 'public.tenants'::regclass) THEN
    CREATE POLICY tenants_update_owner ON tenants
      FOR UPDATE
      USING (id = get_tenant_id() AND get_user_role() = 'owner')
      WITH CHECK (id = get_tenant_id() AND get_user_role() = 'owner');
  END IF;
END $$;

-- Add WITH CHECK to tenants_update_owner if it's missing (the original
-- policy had `with_check = null`, which means UPDATE doesn't validate the
-- new row — a tenant_id flip during update would slip through. Drop and
-- recreate with the explicit WITH CHECK).
DO $$
DECLARE
  with_check_expr text;
BEGIN
  SELECT pg_get_expr(polwithcheck, polrelid) INTO with_check_expr
    FROM pg_policy
    WHERE polname = 'tenants_update_owner' AND polrelid = 'public.tenants'::regclass;
  IF with_check_expr IS NULL THEN
    DROP POLICY IF EXISTS tenants_update_owner ON tenants;
    CREATE POLICY tenants_update_owner ON tenants
      FOR UPDATE
      USING (id = get_tenant_id() AND get_user_role() = 'owner')
      WITH CHECK (id = get_tenant_id() AND get_user_role() = 'owner');
  END IF;
END $$;
