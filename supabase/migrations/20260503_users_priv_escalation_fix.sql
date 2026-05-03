-- users RLS — block self-promotion privilege escalation. Group 15 P0.
--
-- The exploit (verified live during the Group 15 audit RLS sweep):
--
--   curl -X PATCH "$SB/rest/v1/users?id=eq.<self>" \
--        -H "apikey: $PUB" -H "Authorization: Bearer $JWT" \
--        --data-raw '{"role":"owner"}'
--
-- The audit harness ran this against Joey's session and successfully
-- demoted him from owner → manager. Promoting in the other direction
-- (staff → owner) is structurally identical — only `users_role_check`
-- enforces enum validity, not authority.
--
-- Net: ANY authenticated tenant member can self-promote to owner of
-- their own tenant by hitting PostgREST directly. From there, every
-- owner-only gate in the app (banking details / billing / role
-- assignment / audit-log read / API keys / data export) is bypassable.
-- This is the single most catastrophic isolation bug the audit has
-- surfaced.
--
-- Root cause: the `users_update_own` RLS policy had USING `id = auth.uid()`
-- and `with_check = null`. PG's USING-fallback for UPDATE re-evaluates the
-- USING expression against the new row — but USING here only references
-- `id`, not `role` or `tenant_id`. So changes to those columns slip
-- through.
--
-- Fix shape: replace the broad self-update policy with a SECURITY DEFINER
-- helper that snapshots the caller's current role and tenant_id once,
-- then a WITH CHECK that enforces the new row matches the snapshot.
-- The narrow set of columns a user IS allowed to self-edit (full_name,
-- avatar_url, totp_*, sms_2fa_*, updated_at) flow through unchanged
-- because the policy only constrains role + tenant_id + id, not other
-- columns.
--
-- The legitimate path to change a user's role lives in the team
-- management server actions (lib/team-actions.ts) which use the
-- service-role admin client and verify owner role at the app layer.
-- Those bypass RLS entirely so this tightening doesn't affect them.

-- Snapshot helper. SECURITY DEFINER so the recursion through public.users
-- doesn't re-trigger the user's own RLS check (would be infinite). STABLE
-- so it can be cached within a single statement.
CREATE OR REPLACE FUNCTION public.current_user_role_and_tenant()
RETURNS TABLE(cur_role text, cur_tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role, tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- Replace the wide-open update policy. New row must match the
-- existing role + tenant_id — i.e. those two columns are EFFECTIVELY
-- read-only for the self-update path. Other columns are unaffected.
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT cur_role FROM public.current_user_role_and_tenant())
    AND tenant_id = (SELECT cur_tenant_id FROM public.current_user_role_and_tenant())
  );

-- Defence-in-depth: revoke direct authenticated-role UPDATE on the
-- two role/tenant columns. With column-level grants pruned, even if
-- a future RLS regression lands the columns can't be PATCHed by
-- authenticated. Service-role retains full access (admin client path
-- in app/lib/team-actions.ts is unaffected).
REVOKE UPDATE (role) ON public.users FROM authenticated;
REVOKE UPDATE (tenant_id) ON public.users FROM authenticated;
