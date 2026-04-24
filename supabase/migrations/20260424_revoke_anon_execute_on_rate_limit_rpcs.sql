-- CRITICAL: tenant-isolation agent finding 2026-04-24.
--
-- The SECURITY DEFINER RPCs backing our Postgres-based rate limiter
-- were created with the default `public` EXECUTE grant, which in
-- Supabase means anon + authenticated can invoke them directly via
-- PostgREST (`.rpc("clear_login_lockouts", ...)` from the anon SDK).
--
-- `clear_login_lockouts` is the critical one: an attacker brute-forcing
-- a victim's password can compute their own `sha256("victim@email:attacker_ip")`
-- and call the RPC to reset the 5-strike lockout between every batch of
-- guesses, defeating the brute-force protection entirely. The service
-- role already bypasses RLS + EXECUTE restrictions, so revoking anon/
-- authenticated doesn't break the legitimate `admin.rpc(...)` call path.
--
-- Same reasoning for `check_login_allowed` + `record_failed_login`
-- (expose lockout state as an enumeration oracle), `next_refund_number`
-- (burns another tenant's refund sequence), and `refresh_tenant_
-- dashboard_stats` (DB-load DoS against any known tenant id).
--
-- `check_and_increment_rate_limit` is a LEGIT anon call path in some
-- callers? No — every caller in the codebase goes via admin client.
-- Revoke.

-- The idempotent DDL (REVOKE ... FROM public) is safe to re-run.

REVOKE EXECUTE ON FUNCTION public.clear_login_lockouts(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_login_lockouts(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_login_lockouts(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_lockouts(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_login_allowed(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_login_allowed(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_login_allowed(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_allowed(text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_failed_login(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_failed_login(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_failed_login(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login(text, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.next_refund_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_refund_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_refund_number(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_refund_number(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

-- Tighten jeweller_reviews SELECT: the public policy `qual=true` exposes
-- consumer_email on every row. Zero rows today so no actual leak, but
-- the moment the first consumer review lands, their email is readable
-- via anon key. Replace with a SELECT policy that still allows anyone
-- to list reviews but the column grant on consumer_email is removed.

-- Approach: drop the current "public" policy, add one that filters to
-- the safe columns by revoking column SELECT on consumer_email for
-- anon + authenticated. (RLS policies don't restrict columns; column
-- grants do.)
REVOKE SELECT (consumer_email) ON public.jeweller_reviews FROM anon;
REVOKE SELECT (consumer_email) ON public.jeweller_reviews FROM authenticated;
-- service_role keeps full SELECT for admin queries and moderation.

-- marketplace_enquiries anon-INSERT: add a foreign-key-ish CHECK so
-- anon can't insert with a made-up tenant_id. The policy grants INSERT
-- to anon; we need to constrain the tenant_id column.
--
-- Can't reference another table in a CHECK, but we CAN add a trigger.
-- Simpler: replace the existing open INSERT policy with one that
-- constrains tenant_id EXISTS in tenants.
DROP POLICY IF EXISTS "Anyone can submit an enquiry" ON public.marketplace_enquiries;

CREATE POLICY "Anyone can submit an enquiry" ON public.marketplace_enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants WHERE tenants.id = marketplace_enquiries.tenant_id)
  );
