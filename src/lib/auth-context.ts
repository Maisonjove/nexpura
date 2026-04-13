/**
 * Unified auth context helper for server components and actions.
 *
 * PERF: Reads userId/tenantId/role from middleware-set request headers
 * instead of calling supabase.auth.getUser() on every navigation.
 * Saves ~50-100ms per page load by skipping the Supabase auth round-trip.
 *
 * Uses request-level memoization via React cache() to prevent
 * duplicate calls within the same request.
 */
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCached, tenantCacheKey } from "@/lib/cache";
import { AUTH_HEADERS, getCachedUserProfile } from "@/lib/cached-auth";
import type { PermissionMap, PermissionKey } from "@/lib/permissions";
import { DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from "@/lib/permissions";

export interface AuthContext {
  userId: string;
  email: string | null;
  tenantId: string;
  tenantName: string | null;
  businessName: string | null;
  currency: string;
  taxRate: number;
  taxName: string;
  taxInclusive: boolean;
  role: string;
  isOwner: boolean;
  isManager: boolean;
  permissions: PermissionMap;
}

// Request-scoped memoization — only hits Redis/DB once per request
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  try {
    let userId: string;
    let tenantId: string;
    let role: string;
    let email: string | null;

    // Fast path: read from middleware headers (no Supabase round-trip needed).
    // Middleware validates the session and forwards these on every protected route.
    const headersList = await headers();
    const headerUserId = headersList.get(AUTH_HEADERS.USER_ID);
    const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);

    if (headerUserId && headerTenantId) {
      userId = headerUserId;
      tenantId = headerTenantId;
      role = headersList.get(AUTH_HEADERS.USER_ROLE) || "staff";
      email = headersList.get(AUTH_HEADERS.USER_EMAIL) || null;
    } else {
      // Fallback for Server Actions or edge cases where headers aren't present
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const admin = createAdminClient();
      const { data: userData } = await admin
        .from("users")
        .select("tenant_id, role")
        .eq("id", user.id)
        .single();

      if (!userData?.tenant_id) return null;

      userId = user.id;
      tenantId = userData.tenant_id;
      role = userData.role ?? "staff";
      email = user.email ?? null;
    }

    // Get full tenant settings from Redis cache (5 min TTL, ~20-40ms on hit)
    const profile = await getCachedUserProfile(userId);
    const tenantData = profile?.tenants as {
      name?: string;
      business_name?: string;
      currency?: string;
      tax_rate?: number;
      tax_name?: string;
      tax_inclusive?: boolean;
    } | null;

    const isOwner = role === "owner";
    const isManager = role === "owner" || role === "manager";

    let permissions: PermissionMap;
    if (isOwner) {
      permissions = Object.fromEntries(
        ALL_PERMISSION_KEYS.map((k) => [k, true])
      ) as PermissionMap;
    } else {
      permissions = await getCached(
        tenantCacheKey(tenantId, "permissions", role),
        async () => {
          const admin = createAdminClient();
          const { data: permRows } = await admin
            .from("role_permissions")
            .select("permission_key, enabled")
            .eq("tenant_id", tenantId)
            .eq("role", role);

          if (!permRows || permRows.length === 0) {
            return (
              DEFAULT_PERMISSIONS[role] ??
              (Object.fromEntries(
                ALL_PERMISSION_KEYS.map((k) => [k, false])
              ) as PermissionMap)
            );
          }

          const map = Object.fromEntries(
            ALL_PERMISSION_KEYS.map((k) => [k, false])
          ) as PermissionMap;
          for (const row of permRows) {
            if (row.permission_key in map) {
              (map as Record<string, boolean>)[row.permission_key] = row.enabled;
            }
          }
          return map;
        },
        300
      );
    }

    return {
      userId,
      email,
      tenantId,
      tenantName: tenantData?.name ?? null,
      businessName: tenantData?.business_name ?? tenantData?.name ?? null,
      currency: tenantData?.currency ?? "AUD",
      taxRate: tenantData?.tax_rate ?? 0.1,
      taxName: tenantData?.tax_name ?? "GST",
      taxInclusive: tenantData?.tax_inclusive ?? true,
      role,
      isOwner,
      isManager,
      permissions,
    };
  } catch {
    return null;
  }
});

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("Not authenticated");
  return ctx;
}

export async function checkPermission(key: PermissionKey): Promise<boolean> {
  const ctx = await getAuthContext();
  if (!ctx) return false;
  return ctx.permissions[key] ?? false;
}

export async function checkAnyPermission(...keys: PermissionKey[]): Promise<boolean> {
  const ctx = await getAuthContext();
  if (!ctx) return false;
  return keys.some((k) => ctx.permissions[k]);
}
