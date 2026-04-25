/**
 * Cached Auth Helpers
 * 
 * Centralized caching for user profile and layout data to eliminate
 * redundant DB calls between middleware and layout.
 * 
 * Cache keys:
 * - user:profile:{userId} - Full user profile with tenant data (5 min TTL)
 * - tenant:{tenantId}:locations - Active locations for tenant (2 min TTL)
 * - user:{userId}:team_member - Team member data for user (2 min TTL)
 */

import { getCached, invalidateCache, invalidateCachePattern } from "./cache";
import { createAdminClient } from "./supabase/admin";

// Cache TTLs in seconds
const PROFILE_TTL = 300; // 5 minutes
const LOCATIONS_TTL = 120; // 2 minutes
const TEAM_MEMBER_TTL = 120; // 2 minutes

// Types for cached data
export interface CachedUserProfile {
  id: string;
  email: string;
  tenant_id: string | null;
  role: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  // PR-05: surfaced so middleware can enforce the AAL2 gate without a
  // second round-trip. `select("*")` already fetches this column.
  totp_enabled?: boolean | null;
  // Nested tenant data
  tenants: {
    id: string;
    name: string;
    slug: string;
    [key: string]: unknown;
  } | null;
  // Allow additional fields
  [key: string]: unknown;
}

export interface CachedLocation {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

export interface CachedTeamMember {
  current_location_id: string | null;
  default_location_id: string | null;
}

/**
 * Get user profile with tenant data, cached for 5 minutes.
 * Returns null if user not found.
 */
export async function getCachedUserProfile(
  userId: string
): Promise<CachedUserProfile | null> {
  const cacheKey = `user:profile:${userId}`;

  return getCached(
    cacheKey,
    async () => {
      // Narrow projection — the fields consumed by middleware + the
      // (app) layout. Avoids shipping every column of users + tenants
      // on every 5-minute cache refresh for every signed-in user.
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("users")
        .select(
          "id, email, tenant_id, role, full_name, created_at, updated_at, totp_enabled, " +
            "tenants(id, name, slug, business_name, business_type, currency, timezone, subscription_status, logo_url, phone, email, abn, address_line1, suburb, state, postcode, country, tax_rate, tax_name, tax_inclusive)",
        )
        .eq("id", userId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as unknown as CachedUserProfile;
    },
    PROFILE_TTL
  );
}

/**
 * Get active locations for a tenant, cached for 2 minutes.
 */
export async function getCachedLocations(
  tenantId: string
): Promise<CachedLocation[]> {
  const cacheKey = `tenant:${tenantId}:locations`;

  return getCached(
    cacheKey,
    async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("locations")
        .select("id, name, type, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");

      return data ?? [];
    },
    LOCATIONS_TTL
  );
}

/**
 * Get team member data for a user, cached for 2 minutes.
 */
export async function getCachedTeamMember(
  userId: string
): Promise<CachedTeamMember | null> {
  const cacheKey = `user:${userId}:team_member`;

  return getCached(
    cacheKey,
    async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("team_members")
        .select("current_location_id, default_location_id")
        .eq("user_id", userId)
        .maybeSingle();

      return data;
    },
    TEAM_MEMBER_TTL
  );
}

/**
 * Invalidate all cached data for a user.
 * Call this when user profile is updated.
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    invalidateCache(`user:profile:${userId}`),
    invalidateCache(`user:${userId}:team_member`),
  ]);
}

/**
 * Invalidate all cached data for a tenant.
 * Call this when tenant data changes (locations, etc).
 */
export async function invalidateTenantAuthCache(tenantId: string): Promise<void> {
  await invalidateCachePattern(`tenant:${tenantId}:*`);
}

/**
 * Invalidate cached locations for a tenant.
 * Call this when locations are added/updated/deleted.
 */
export async function invalidateLocationsCache(tenantId: string): Promise<void> {
  await invalidateCache(`tenant:${tenantId}:locations`);
}

// Header names for passing auth data from middleware to layout
export const AUTH_HEADERS = {
  USER_ID: "x-auth-user-id",
  TENANT_ID: "x-auth-tenant-id",
  USER_ROLE: "x-auth-user-role",
  USER_EMAIL: "x-auth-user-email",
} as const;
