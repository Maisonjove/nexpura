-- =====================================================
-- Customer visibility for location-restricted users
-- Audit finding (Medium): customers table has no location_id (tenant-
-- global by design), so location-restricted staff (allowed_location_ids
-- = ['A']) could see every customer in the tenant — including those
-- who only transact at other locations. Privacy gap, not a data-breach
-- class issue but worth closing before public self-serve.
--
-- Policy: a restricted user sees a customer iff
--   (a) the customer has at least one sale/repair/bespoke at an
--       allowed location, OR
--   (b) the customer has no location-scoped activity at all (brand-
--       new customer, not yet attached to any location).
-- All-access users (owner/manager with null allowed_location_ids) see
-- every customer in the tenant.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_visible_customer_ids(
  p_user_id uuid,
  p_tenant_id uuid
) RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed uuid[];
BEGIN
  -- team_members.allowed_location_ids: NULL = all-access, array = restricted.
  SELECT allowed_location_ids INTO v_allowed
    FROM team_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  IF v_allowed IS NULL THEN
    RETURN QUERY
      SELECT id FROM customers
      WHERE tenant_id = p_tenant_id AND deleted_at IS NULL;
    RETURN;
  END IF;

  -- Empty allow-list: user has no location access; return no rows.
  IF array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT DISTINCT c.id
    FROM customers c
    WHERE c.tenant_id = p_tenant_id AND c.deleted_at IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM sales s
          WHERE s.customer_id = c.id
            AND s.location_id = ANY(v_allowed)
        )
        OR EXISTS (
          SELECT 1 FROM repairs r
          WHERE r.customer_id = c.id
            AND r.location_id = ANY(v_allowed)
        )
        OR EXISTS (
          SELECT 1 FROM bespoke_jobs b
          WHERE b.customer_id = c.id
            AND b.location_id = ANY(v_allowed)
        )
        OR (
          NOT EXISTS (
            SELECT 1 FROM sales s2
            WHERE s2.customer_id = c.id AND s2.location_id IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM repairs r2
            WHERE r2.customer_id = c.id AND r2.location_id IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM bespoke_jobs b2
            WHERE b2.customer_id = c.id AND b2.location_id IS NOT NULL
          )
        )
      );
END;
$$;

REVOKE ALL ON FUNCTION public.get_visible_customer_ids(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_customer_ids(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.get_visible_customer_ids(uuid, uuid) IS
  'Returns customer IDs the given user is allowed to see, enforcing location-scoped visibility. All-access users get every non-deleted customer; restricted users get customers with activity at allowed locations OR customers with no location-scoped activity at all.';
