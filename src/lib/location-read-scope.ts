import { getUserLocationIds } from "@/lib/locations";

/**
 * Shared read-scope helper. For every location-scoped list surface
 * (repairs, bespoke, inventory, sales, invoices, etc.), call this to
 * decide whether the current user has all-access (owner/manager or
 * explicitly null allowed_location_ids) or is restricted to a subset.
 *
 * Returns `{ all: true }` when no filter is needed; the caller
 * leaves its query untouched.
 *
 * Returns `{ all: false, allowedIds: string[] }` when the user is
 * location-restricted; the caller chains `.in("location_id", allowedIds)`
 * AND the branch where `location_id IS NULL` is also included (legacy
 * rows pre-location column) via a separate `.or()`:
 *
 *   let q = admin.from("repairs").select(...).eq("tenant_id", tenantId);
 *   const scope = await resolveReadLocationScope(userId, tenantId);
 *   if (!scope.all) {
 *     q = q.or(`location_id.in.(${scope.allowedIds.join(",")}),location_id.is.null`);
 *   }
 *
 * Audit finding (High): list-query paths ignored allowed_location_ids,
 * so a location-restricted user could see cross-location data via the
 * same authed client the app uses for its reads.
 */
export async function resolveReadLocationScope(
  userId: string,
  tenantId: string,
): Promise<{ all: true } | { all: false; allowedIds: string[] }> {
  const ids = await getUserLocationIds(userId, tenantId);
  // getUserLocationIds returns null for owners/managers (all access) and
  // an array (possibly empty) for restricted users.
  if (ids === null) return { all: true };
  // Empty array = user has no location access at all. We still return
  // a filter; callers produce empty results instead of leaking. (The
  // user should not have been granted app access in this state.)
  return { all: false, allowedIds: ids };
}

/**
 * Convenience: produce a PostgREST `.or(...)` filter string that matches
 * either `location_id IN (allowed)` OR `location_id IS NULL`. Wrapping
 * in an OR ensures legacy rows pre-dating the location_id column remain
 * visible to the restricted user — they're already in their tenant and
 * location_id was never set, so hiding them would be surprising.
 *
 * Returns null when the user has all-access (caller skips filter).
 */
export async function locationScopeFilter(
  userId: string,
  tenantId: string,
): Promise<string | null> {
  const scope = await resolveReadLocationScope(userId, tenantId);
  if (scope.all) return null;
  if (scope.allowedIds.length === 0) {
    // Zero allowed → match nothing. Use an impossible UUID so the IN
    // clause is well-formed but the row set is empty.
    return "location_id.eq.00000000-0000-0000-0000-000000000000";
  }
  return `location_id.in.(${scope.allowedIds.join(",")}),location_id.is.null`;
}
