/**
 * Unified auth context helper for server components and actions.
 * Eliminates repeated auth + user lookups across the codebase.
 * 
 * Uses request-level memoization via React cache() to prevent
 * duplicate DB calls within the same request.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCached, tenantCacheKey } from "@/lib/cache";
import type { PermissionMap, PermissionKey } from "@/lib/permissions";
import { DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from "@/lib/permissions";

export interface AuthContext {
  userId: string;
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

// Request-scoped memoization using React cache()
// This ensures within a single request, we only hit the DB once
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminClient();
    
    // Single query to get user + tenant data
    const { data: userData } = await admin
      .from("users")
      .select(`
        tenant_id, role, full_name,
        tenants(
          name, business_name, currency, 
          tax_rate, tax_name, tax_inclusive
        )
      `)
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return null;

    const tenantData = userData.tenants as {
      name?: string;
      business_name?: string;
      currency?: string;
      tax_rate?: number;
      tax_name?: string;
      tax_inclusive?: boolean;
    } | null;

    const role = userData.role ?? "staff";
    const isOwner = role === "owner";
    const isManager = role === "owner" || role === "manager";

    // Get permissions - cache in Redis for 5 minutes
    let permissions: PermissionMap;
    if (isOwner) {
      // Owner always has all permissions - no DB needed
      permissions = Object.fromEntries(
        ALL_PERMISSION_KEYS.map((k) => [k, true])
      ) as PermissionMap;
    } else {
      permissions = await getCached(
        tenantCacheKey(userData.tenant_id, "permissions", role),
        async () => {
          const { data: permRows } = await admin
            .from("role_permissions")
            .select("permission_key, enabled")
            .eq("tenant_id", userData.tenant_id)
            .eq("role", role);

          if (!permRows || permRows.length === 0) {
            return DEFAULT_PERMISSIONS[role] ?? 
              Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as PermissionMap;
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
        300 // 5 minute TTL
      );
    }

    return {
      userId: user.id,
      tenantId: userData.tenant_id,
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

// Shorthand for getting auth context with required flag
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error("Not authenticated");
  }
  return ctx;
}

// Quick permission check using cached context
export async function checkPermission(key: PermissionKey): Promise<boolean> {
  const ctx = await getAuthContext();
  if (!ctx) return false;
  return ctx.permissions[key] ?? false;
}

// Check if user has any of the given permissions
export async function checkAnyPermission(...keys: PermissionKey[]): Promise<boolean> {
  const ctx = await getAuthContext();
  if (!ctx) return false;
  return keys.some((k) => ctx.permissions[k]);
}
