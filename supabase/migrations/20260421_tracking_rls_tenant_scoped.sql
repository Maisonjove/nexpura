-- =====================================================
-- Tighten RLS on order_status_history + order_attachments
-- Audit finding (Critical): the prior policies
--   FOR SELECT USING (true)                -- order_status_history
--   FOR SELECT USING (is_public = true)    -- order_attachments
-- allowed unauthenticated direct PostgREST queries (via the anon key,
-- which is public by design) to dump every tenant's tracking data.
--
-- Fix: drop the anon-wide policies and replace with a tenant-scoped
-- SELECT policy for authenticated users. The public /track/[id] page
-- uses the admin (service-role) client server-side, which bypasses RLS
-- entirely — so tightening the anon surface does NOT break the public
-- tracking flow. The in-app CustomerAttachments component uses the
-- authed user client; the new tenant-scoped policy keeps that working.
--
-- Net effect:
--  - anon key → 0 rows from either table (was: entire table)
--  - authed user → only rows matching their tenant
--  - service role → unchanged (full access via the existing policy)
--
-- This migration is idempotent: safe to re-run.
-- =====================================================

-- 1. order_status_history -------------------------------------------------

DROP POLICY IF EXISTS "Allow public read for status history" ON public.order_status_history;

DROP POLICY IF EXISTS "Authed tenant read status history" ON public.order_status_history;
CREATE POLICY "Authed tenant read status history" ON public.order_status_history
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- 2. order_attachments ----------------------------------------------------

DROP POLICY IF EXISTS "Allow public read for public attachments" ON public.order_attachments;

DROP POLICY IF EXISTS "Authed tenant read attachments" ON public.order_attachments;
CREATE POLICY "Authed tenant read attachments" ON public.order_attachments
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- 3. Confirm RLS is still enabled (belt-and-suspenders) -------------------

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_attachments    ENABLE ROW LEVEL SECURITY;

-- 4. Documentation --------------------------------------------------------

COMMENT ON POLICY "Authed tenant read status history" ON public.order_status_history IS
  'Replaces prior USING (true) policy that allowed cross-tenant anonymous reads via PostgREST. The /track/[id] page uses the service role and is unaffected.';

COMMENT ON POLICY "Authed tenant read attachments" ON public.order_attachments IS
  'Replaces prior USING (is_public = true) policy. is_public is not a sufficient tenant gate — a single stray is_public=true row leaked cross-tenant. The /track/[id] page uses the service role; in-app CustomerAttachments queries are tenant-scoped via this policy.';
