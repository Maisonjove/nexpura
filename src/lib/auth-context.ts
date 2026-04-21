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
  subscriptionStatus: string | null;
}

// Subscription states that permit mutating operations. Anything else
// (suspended, unpaid, cancelled, incomplete_expired) is blocked by
// requireActiveTenant at the shared auth layer.
export const MUTATING_SUBSCRIPTION_STATES = new Set([
  "active",
  "trialing",
  "past_due", // still in grace window; cron flips to suspended after expiry
  "payment_required", // same
]);

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

    // Compute role flags before parallel fetch so we can skip permissions DB call for owners
    const isOwner = role === "owner";
    const isManager = role === "owner" || role === "manager";
    const permCacheKey = tenantCacheKey(tenantId, "permissions", role);

    // Fetch user profile and permissions in parallel — saves ~300ms on cold Redis
    const [profile, permissions] = await Promise.all([
      getCachedUserProfile(userId),
      isOwner
        ? Promise.resolve(
            Object.fromEntries(
              ALL_PERMISSION_KEYS.map((k) => [k, true])
            ) as PermissionMap
          )
        : getCached(
            permCacheKey,
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
                  (map as Record<string, boolean>)[row.permission_key] =
                    row.enabled;
                }
              }
              return map;
            },
            300
          ),
    ]);

    const tenantData = profile?.tenants as {
      name?: string;
      business_name?: string;
      currency?: string;
      tax_rate?: number;
      tax_name?: string;
      tax_inclusive?: boolean;
      subscription_status?: string | null;
    } | null;

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
      subscriptionStatus: tenantData?.subscription_status ?? null,
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

/**
 * Shared choke point for every mutating server action / API route.
 * Blocks tenants whose subscription has lapsed past grace. Relying on UI
 * gating is not sufficient — a suspended tenant with a valid session can
 * still POST directly. Call this from each write surface (or from the
 * action's shared auth helper).
 *
 * Throws `Error("subscription_required")` so the caller's existing
 * try/catch surfaces a clear error to the user.
 */
export async function requireActiveTenant(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!isTenantActive(ctx)) {
    throw new Error("subscription_required");
  }
  return ctx;
}

export function isTenantActive(ctx: AuthContext): boolean {
  // Missing subscription_status is treated as active for tenants that
  // predate the subscription state tracking — don't break existing tenants.
  // Explicit "suspended" / "unpaid" / "cancelled" states are rejected.
  if (!ctx.subscriptionStatus) return true;
  return MUTATING_SUBSCRIPTION_STATES.has(ctx.subscriptionStatus);
}

/**
 * Assert a specific permission. Use in mutating server actions/route
 * handlers so RBAC is enforced server-side (UI hiding a button is not
 * sufficient — staff can hit the endpoint directly).
 * Owners always pass (matching getAuthContext behaviour).
 */
export async function requirePermission(key: PermissionKey): Promise<AuthContext> {
  const ctx = await requireActiveTenant();
  if (ctx.isOwner) return ctx;
  if (!(ctx.permissions[key] ?? false)) {
    throw new Error(`permission_denied:${key}`);
  }
  return ctx;
}

/**
 * Assert that the caller holds at least one of the given roles.
 *
 * Used for privilege-escalation / tenant-wide mutations (roles management,
 * banking details, bulk exports, scheduled-report wiring) where the
 * permission matrix is too coarse and we want a hard owner-only (or
 * owner+manager) gate. UI buttons are not sufficient — staff can POST the
 * endpoint directly.
 *
 * Throws `Error("role_denied:<roles>")` so callers' try/catch surfaces the
 * specific rule that blocked them.
 */
export async function requireRole(
  ...roles: Array<"owner" | "manager">
): Promise<AuthContext> {
  const ctx = await requireActiveTenant();
  // Owner is always allowed if any role is requested (super-role)
  if (ctx.isOwner) return ctx;
  if (roles.includes("manager") && ctx.role === "manager") return ctx;
  if (roles.includes("owner") && ctx.isOwner) return ctx;
  throw new Error(`role_denied:${roles.join(",")}`);
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
