import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import logger from "@/lib/logger";
import { LOCATION_COOKIE } from "@/lib/location-cookie";

// Server-side: read the user's selected location from the cookie. Returns
// null when no location is selected ("All Locations" view) or when the
// cookie is empty/missing. Caller is responsible for validating that the
// authenticated user has access to the returned ID before using it as a
// query filter.
export async function getSelectedLocationIdFromCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    const raw = store.get(LOCATION_COOKIE)?.value;
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

export interface Location {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  address_line1?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  operating_hours?: Record<string, { open: string; close: string }>;
  default_tax_rate?: number;
  receipt_footer?: string;
}

/**
 * Get all locations the current user has access to.
 *
 * Canonical contract (matches LocationContext.tsx + TransfersClient.tsx +
 * the 13 read sites that consume the result):
 *   null         → all-access (owner/manager, OR explicit
 *                  allowed_location_ids=null on team_members)
 *   string[]     → restricted to exactly these location IDs
 *   string[] = [] → no access at all (caller produces empty result)
 *
 * Owner/manager fallback (C-02 fix, 2026-05-05): when no team_members
 * row exists for (user_id, tenant_id), check public.users.role. If the
 * user is the tenant's owner or manager according to public.users,
 * treat them as having full access. This shouldn't happen in normal
 * flow, but historical drift can leave owners without the row —
 * specifically the (auth)/onboarding/actions.ts path between
 * 2026-03-13 and 2026-04-28 (10 affected owners) inserted users +
 * tenant + subscription + location but never wrote team_members.
 * Fail-open here is correct because the role itself authorizes the
 * access — and the upstream onboarding fix in this same PR ensures
 * every NEW signup writes the row.
 *
 * Without this fallback, getSales (sales-actions.ts) and every other
 * location-scoped read collapses to an impossible-UUID filter,
 * returning 0 rows and rendering an empty list to a tenant owner who
 * actually has data — exactly the C-02 audit finding (hello@nexpura
 * /sales returned [] despite the tenant having a sale).
 */
export async function getUserLocationIds(userId: string, tenantId: string): Promise<string[] | null> {
  const admin = createAdminClient();

  // Get team member record
  const { data: member } = await admin
    .from("team_members")
    .select("role, allowed_location_ids")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .single();

  if (!member) {
    // No team_members row — fall back to public.users.role for the same
    // tenant. Owners/managers get all-access; anyone else falls through
    // to the existing zero-allow-list behaviour (caller produces empty
    // result). The fallback fires as a Sentry breadcrumb (info level)
    // so we can watch how often this triggers post-deploy and confirm
    // the rate decays as the backfill + onboarding fix close the gap.
    const { data: userRow } = await admin
      .from("users")
      .select("role, tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (
      userRow?.tenant_id === tenantId &&
      (userRow.role === "owner" || userRow.role === "manager")
    ) {
      logger.info("[locations] getUserLocationIds owner/manager fallback fired", {
        userId,
        tenantId,
        usersRole: userRow.role,
        reason: "no team_members row; users.role authorizes access",
      });
      return null;
    }

    return [];
  }

  // Owners and managers have access to all locations
  if (member.role === "owner" || member.role === "manager") {
    return null; // null = all locations
  }

  // If allowed_location_ids is null, they have all access
  // If it's an array, they're restricted to those locations
  return member.allowed_location_ids ?? null;
}

/**
 * Get locations user can access with full details
 */
export async function getUserLocations(userId: string, tenantId: string): Promise<Location[]> {
  const admin = createAdminClient();
  const allowedIds = await getUserLocationIds(userId, tenantId);
  
  let query = admin
    .from("locations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
  
  // If restricted to specific locations, filter
  if (allowedIds !== null && allowedIds.length > 0) {
    query = query.in("id", allowedIds);
  } else if (allowedIds !== null && allowedIds.length === 0) {
    // No access to any location
    return [];
  }
  
  const { data } = await query;
  return data ?? [];
}

/**
 * Check if user has access to a specific location
 */
export async function hasLocationAccess(userId: string, tenantId: string, locationId: string): Promise<boolean> {
  const allowedIds = await getUserLocationIds(userId, tenantId);
  
  // null = all access
  if (allowedIds === null) return true;
  
  return allowedIds.includes(locationId);
}

/**
 * Build a Supabase query filter for location access
 * Returns the location IDs to filter by, or null if no filtering needed
 */
export function buildLocationFilter(allowedLocationIds: string[] | null, selectedLocationId?: string | null): string[] | null {
  // If user selected a specific location, use that
  if (selectedLocationId) {
    // Verify user has access to this location
    if (allowedLocationIds === null || allowedLocationIds.includes(selectedLocationId)) {
      return [selectedLocationId];
    }
    // User doesn't have access to selected location, return empty to show nothing
    return [];
  }
  
  // No specific location selected, use user's allowed locations
  return allowedLocationIds;
}

/**
 * Get location stats for dashboard widgets
 */
export async function getLocationStats(tenantId: string, locationId?: string | null) {
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  
  let locationFilter: Record<string, string | undefined> = {};
  if (locationId) {
    locationFilter = { location_id: locationId };
  }
  
  const [
    lowStockResult,
    pendingRepairsResult,
    todayAppointmentsResult
  ] = await Promise.all([
    // Low stock items at this location
    admin
      .from("inventory")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("track_quantity", true)
      .is("deleted_at", null)
      .match(locationFilter)
      .lt("quantity", 3), // simplified threshold check
    
    // Pending repairs at this location
    admin
      .from("repairs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("stage", "in", '("collected","cancelled")')
      .is("deleted_at", null)
      .match(locationId ? { location_id: locationId } : {}),
    
    // Today's appointments (placeholder - needs appointments table)
    Promise.resolve({ count: 0 })
  ]);
  
  return {
    lowStockCount: lowStockResult.count ?? 0,
    pendingRepairsCount: pendingRepairsResult.count ?? 0,
    todayAppointmentsCount: todayAppointmentsResult.count ?? 0,
  };
}

/**
 * Get comparison data for multiple locations
 */
export async function getLocationComparison(
  tenantId: string, 
  locationIds: string[],
  startDate: string,
  endDate: string
) {
  const admin = createAdminClient();
  
  const comparisons = await Promise.all(
    locationIds.map(async (locationId) => {
      const [salesResult, repairsResult, stockResult, staffResult] = await Promise.all([
        // Sales total for location
        admin
          .from("sales")
          .select("total")
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        
        // Completed repairs count
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .eq("stage", "collected")
          .gte("updated_at", startDate)
          .lte("updated_at", endDate),
        
        // Stock value at location
        admin
          .from("inventory")
          .select("retail_price, quantity")
          .eq("tenant_id", tenantId)
          .eq("location_id", locationId)
          .eq("status", "active")
          .is("deleted_at", null),
        
        // Staff count at location
        admin
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .contains("allowed_location_ids", [locationId]),
      ]);
      
      const salesTotal = (salesResult.data ?? []).reduce((sum, s) => sum + (s.total || 0), 0);
      const stockValue = (stockResult.data ?? []).reduce((sum, i) => sum + ((i.retail_price || 0) * Math.max(i.quantity || 0, 0)), 0);
      
      return {
        locationId,
        salesTotal,
        repairsCompleted: repairsResult.count ?? 0,
        stockValue,
        staffCount: staffResult.count ?? 0,
      };
    })
  );
  
  return comparisons;
}
