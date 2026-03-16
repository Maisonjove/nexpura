/**
 * Server-side entitlement helpers.
 * Call from Server Components / page.tsx to gate plan-specific features.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseFeature, canonicalPlan, getMaxUsers, getMaxLocations, type PlanFeatureKey } from "@/lib/features";

export interface EntitlementContext {
  plan: string;               // canonical: boutique | studio | atelier
  rawPlan: string;            // as stored in DB
  tenantId: string | null;
  userId: string | null;
}

/**
 * Get the subscription plan for the currently authenticated user.
 * Falls back to "boutique" if no subscription found.
 */
export async function getEntitlementContext(): Promise<EntitlementContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { plan: "boutique", rawPlan: "boutique", tenantId: null, userId: null };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return { plan: "boutique", rawPlan: "boutique", tenantId: null, userId: user.id };
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("tenant_id", userData.tenant_id)
    .maybeSingle();

  const rawPlan = sub?.plan ?? "boutique";
  return {
    plan: canonicalPlan(rawPlan),
    rawPlan,
    tenantId: userData.tenant_id,
    userId: user.id,
  };
}

/** Check if the current user's plan allows a feature */
export async function checkFeature(feature: PlanFeatureKey): Promise<boolean> {
  const ctx = await getEntitlementContext();
  return canUseFeature(ctx.plan, feature);
}

/** Get user and location limits for current plan */
export async function getPlanLimits(plan: string) {
  return {
    maxUsers: getMaxUsers(plan),
    maxLocations: getMaxLocations(plan),
  };
}

/** Check user count against plan limit */
export async function checkUserLimit(tenantId: string, plan: string): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const max = getMaxUsers(plan);
  const current = count ?? 0;
  return { allowed: max === null || current < max, current, max };
}
