/**
 * Per-resource location scope guard.
 *
 * Audit finding W2-005 / W2-006: multi-location tenants could hand a
 * location-restricted staff member a PDF or email-receipt route, and
 * the route would happily serve a repair / invoice / bespoke job
 * belonging to a DIFFERENT location of the same tenant — because the
 * routes only checked `tenant_id`, not `location_id`.
 *
 * This helper closes that. After loading the target row by tenant,
 * call `assertUserCanAccessLocation(resource.location_id)` and the
 * helper throws a 403-equivalent error if the user's
 * `team_members.allowed_location_ids` doesn't include the row's
 * location. Owners/managers (null allowed_location_ids) pass through.
 *
 * Rows with `location_id IS NULL` (legacy, pre-location-column rows)
 * are allowed through to every authorized user — they predate the
 * feature and hiding them would surprise the tenant.
 *
 * This module is imported from Node-runtime routes only (PDF/email
 * handlers). It uses the admin Supabase client via getUserLocationIds
 * which already reads `team_members` server-side.
 */
import { getUserLocationIds } from "@/lib/locations";

/** Thrown when the session user is location-restricted and the resource's
 * location is outside their `allowed_location_ids` set. Route handlers
 * should catch and return `NextResponse.json({error:"forbidden"},{status:403})`.
 */
export class LocationAccessDeniedError extends Error {
  readonly code = "LOCATION_ACCESS_DENIED" as const;
  constructor(message = "Location scope denied for this resource") {
    super(message);
    this.name = "LocationAccessDeniedError";
  }
}

/**
 * Throws LocationAccessDeniedError if the session user is restricted
 * to a set of locations AND the given `locationId` is not in that set.
 * - `locationId === null` / undefined: legacy row, pass through.
 * - `getUserLocationIds()` returns null: owner/manager, pass through.
 * - Empty array: user has no location access; deny unconditionally
 *   unless the resource is a legacy null-location row.
 */
export async function assertUserCanAccessLocation(
  userId: string,
  tenantId: string,
  locationId: string | null | undefined,
): Promise<void> {
  // Legacy rows pre-location-column: allow-through.
  if (locationId === null || locationId === undefined) return;

  const allowed = await getUserLocationIds(userId, tenantId);
  // null = owner/manager (all access)
  if (allowed === null) return;

  if (!allowed.includes(locationId)) {
    throw new LocationAccessDeniedError();
  }
}

/**
 * Boolean variant. Useful for callers that want to branch their own
 * error envelope (e.g. return a redirect rather than throw).
 */
export async function userCanAccessLocation(
  userId: string,
  tenantId: string,
  locationId: string | null | undefined,
): Promise<boolean> {
  try {
    await assertUserCanAccessLocation(userId, tenantId, locationId);
    return true;
  } catch (e) {
    if (e instanceof LocationAccessDeniedError) return false;
    throw e;
  }
}
