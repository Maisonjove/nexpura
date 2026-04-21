import { createAdminClient } from "@/lib/supabase/admin";
import { MUTATING_SUBSCRIPTION_STATES } from "@/lib/auth-context";

/**
 * Shared paywall choke point. Call from every mutating server action
 * / API route after obtaining tenantId from auth.
 *
 * Throws Error("subscription_required") when the tenant's subscription
 * is suspended/unpaid/cancelled so UI gating isn't the only defense
 * (a suspended tenant with a valid session could previously POST
 * directly to every write endpoint).
 *
 * Safe to call from any context. Uses the admin client so RLS cannot
 * hide the tenants row from this check.
 */
export async function assertTenantActive(tenantId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("subscription_status")
    .eq("id", tenantId)
    .single();
  // Tenants predating the subscription state tracking have null/undefined
  // subscription_status — treat as active to avoid breaking existing
  // customers on migration.
  const status = data?.subscription_status;
  if (status && !MUTATING_SUBSCRIPTION_STATES.has(status)) {
    throw new Error("subscription_required");
  }
}
