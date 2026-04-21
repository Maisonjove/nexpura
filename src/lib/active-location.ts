import { getSelectedLocationIdFromCookie, getUserLocations } from "@/lib/locations";

/**
 * Resolve the location_id a new record should be stamped with, with an
 * explicit resolution policy that never silently produces NULL when the
 * tenant has locations configured.
 *
 * Returns one of three shapes:
 *   { locationId: string } — unambiguous answer, use it
 *   { needsSelection: true, locationCount } — the user is in "All
 *     Locations" view and the tenant has 2+ active locations; the caller
 *     should reject the create with a clear "select a location first"
 *     message. Never write NULL in this state.
 *   { locationId: null, locationCount: 0 } — the tenant has no active
 *     locations configured. Creating with NULL is acceptable here because
 *     there is nothing else to stamp; the tenant hasn't set up locations.
 *
 * Resolution order:
 *   1. If the user has a specific location selected in the cookie AND
 *      they have access to it, use it. (This is the common path.)
 *   2. Otherwise, count the tenant's active locations the user can see.
 *      - 0 active locations → allow NULL (no location configured).
 *      - 1 active location → auto-use it (unambiguous default).
 *      - 2+ active locations → needsSelection=true; the caller must
 *        return a user-facing "select a location first" error and not
 *        proceed with the insert.
 *
 * This replaces the old per-file `resolveActiveLocationId` pattern that
 * returned `null` in "All Locations" view and silently orphaned newly
 * created rows from every location-filtered view.
 */
export async function resolveLocationForCreate(
  tenantId: string,
  userId: string,
): Promise<
  | { locationId: string; needsSelection?: false }
  | { locationId: null; needsSelection: true; locationCount: number }
  | { locationId: null; needsSelection: false; locationCount: 0 }
> {
  const cookieLoc = await getSelectedLocationIdFromCookie();
  const userLocations = await getUserLocations(userId, tenantId);

  if (cookieLoc) {
    const match = userLocations.find((l) => l.id === cookieLoc);
    if (match) return { locationId: cookieLoc };
    // Cookie references a location the user no longer has access to; fall
    // through to the tenant-default logic.
  }

  if (userLocations.length === 0) {
    return { locationId: null, needsSelection: false, locationCount: 0 };
  }
  if (userLocations.length === 1) {
    return { locationId: userLocations[0].id };
  }
  return { locationId: null, needsSelection: true, locationCount: userLocations.length };
}

/**
 * User-facing message to surface when needsSelection is true. Shared so
 * every create surface tells the jeweller the same thing.
 */
export const LOCATION_REQUIRED_MESSAGE =
  "Please select a specific location before creating this record. You're currently viewing All Locations — pick one from the location switcher in the header.";
