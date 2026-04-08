"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { initDefaultPermissions } from "@/lib/permissions";
import logger from "@/lib/logger";
import { invalidateUserCache } from "@/lib/cached-auth";

// ============================================================================
// VALIDATION & SANITIZATION
// ============================================================================

const MAX_BUSINESS_NAME_LENGTH = 100;
const VALID_PLANS = ["boutique", "studio", "atelier"] as const;
const VALID_BUSINESS_TYPES = [
  "Independent Jeweller",
  "Jewellery Studio",
  "Retail Store",
  "Workshop",
  "Online Store",
  "Other",
];

function sanitizeString(str: string | undefined | null, maxLength: number): string {
  if (!str || typeof str !== "string") return "";
  // Trim, limit length, remove control characters
  return str.trim().slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

export async function completeOnboarding(
  businessName: string,
  businessType: string,
  plan: "boutique" | "studio" | "atelier"
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Validate and sanitize inputs
    const sanitizedName = sanitizeString(businessName, MAX_BUSINESS_NAME_LENGTH);
    if (!sanitizedName || sanitizedName.length < 2) {
      return { error: "Business name must be at least 2 characters" };
    }

    const sanitizedType = VALID_BUSINESS_TYPES.includes(businessType) 
      ? businessType 
      : "Other";

    const validPlan = VALID_PLANS.includes(plan) ? plan : "boutique";

    // SECURITY: Check if user already has a tenant (prevent duplicate onboarding).
    // Use admin client to avoid RLS recursion. If the current session belongs to
    // a different user who already has a tenant, sign them out and reject — this
    // prevents session bleed where a new signup inherits an existing user's account.
    const adminCheck = createAdminClient();
    const { data: existingUser } = await adminCheck
      .from("users")
      .select("tenant_id, email")
      .eq("id", user.id)
      .single();

    if (existingUser?.tenant_id) {
      // If the session user's email doesn't match — mismatched session, force sign out
      if (existingUser.email && user.email && existingUser.email !== user.email) {
        await supabase.auth.signOut();
        return { error: "Session mismatch detected. Please sign in again." };
      }
      // Legitimate: user already completed onboarding, just redirect them
      redirect("/dashboard");
    }

    const adminClient = createAdminClient();

  // Generate unique slug
  let slug = slugify(sanitizedName);
  if (!slug) slug = "business";

  // Check if slug exists and make unique
  const { data: existingTenant } = await adminClient
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existingTenant) {
    slug = `${slug}-${randomSuffix()}`;
  }

  // 1. Insert tenant (with plan to keep tenants.plan in sync with subscriptions.plan)
  const { data: tenant, error: tenantErr } = await adminClient
    .from("tenants")
    .insert({
      name: sanitizedName,
      slug,
      business_type: sanitizedType,
      plan: validPlan,
    })
    .select()
    .single();

  if (tenantErr || !tenant) {
    logger.error("Tenant creation error:", tenantErr);
    return { error: tenantErr?.message ?? "Failed to create business" };
  }

  // 2. Insert user record
  // Note: We intentionally do NOT use OAuth metadata for full_name
  // Users don't expect their Google profile name to appear without consent
  // They can set their name in Settings if desired
  const { error: userErr } = await adminClient.from("users").upsert(
    {
      id: user.id,
      tenant_id: tenant.id,
      email: user.email ?? "",
      full_name: "Owner", // Default - user can change in settings
      role: "owner",
    },
    { onConflict: "id" }
  );

  if (userErr) {
    logger.error("User creation error:", userErr);
    // Clean up tenant
    await adminClient.from("tenants").delete().eq("id", tenant.id);
    return { error: userErr.message };
  }

  // 3. Insert subscription (14-day trial)
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const { error: subErr } = await adminClient.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan: validPlan,
    status: "trialing",
    trial_ends_at: trialEndsAt.toISOString(),
  });

  if (subErr) {
    logger.error("Subscription creation error:", subErr);
    // Clean up tenant on failure
    await adminClient.from("users").delete().eq("id", user.id);
    await adminClient.from("tenants").delete().eq("id", tenant.id);
    return { error: "Failed to create subscription" };
  }

  // 4. Create a default location for the tenant (sanitized name)
  const locationName = `${sanitizedName} - Main Store`.slice(0, 100);
  const { error: locationErr } = await adminClient.from("locations").insert({
    tenant_id: tenant.id,
    name: locationName,
    type: "retail",
    is_active: true,
  });

  if (locationErr) {
    logger.error("Default location creation error:", locationErr);
    // Non-critical — user can create location in settings
  }

  // Seed default permissions for all roles
  try {
    await initDefaultPermissions(tenant.id);
  } catch (permErr) {
    logger.error("Permission seeding error:", permErr);
    // Non-critical — continue
  }

  // Invalidate user cache so layout picks up new user profile
  await invalidateUserCache(user.id);

  redirect("/dashboard");
  } catch (error) {
    // Next.js redirect() throws a special error — must re-throw it or the redirect is swallowed
    if (isRedirectError(error)) throw error;
    logger.error("completeOnboarding failed", { error });
    return { error: "Something went wrong. Please try again." };
  }
}
