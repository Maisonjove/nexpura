"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { initDefaultPermissions } from "@/lib/permissions";
import logger from "@/lib/logger";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const adminClient = createAdminClient();

  // Generate unique slug
  let slug = slugify(businessName);
  if (!slug) slug = "business";

  // Check if slug exists
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
      name: businessName,
      slug,
      business_type: businessType,
      plan, // Keep in sync with subscriptions.plan
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
    plan,
    status: "trialing",
    trial_ends_at: trialEndsAt.toISOString(),
  });

  if (subErr) {
    logger.error("Subscription creation error:", subErr);
    return { error: subErr.message };
  }

  // 4. Create a default location for the tenant
  const { error: locationErr } = await adminClient.from("locations").insert({
    tenant_id: tenant.id,
    name: `${businessName} - Main Store`,
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
  } catch {
    // Non-critical — continue
  }

  redirect("/dashboard");
}
