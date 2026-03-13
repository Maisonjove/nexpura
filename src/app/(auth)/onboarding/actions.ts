"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { initDefaultPermissions } from "@/lib/permissions";

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
  plan: "basic" | "pro" | "ultimate"
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

  // 1. Insert tenant
  const { data: tenant, error: tenantErr } = await adminClient
    .from("tenants")
    .insert({
      name: businessName,
      slug,
      business_type: businessType,
    })
    .select()
    .single();

  if (tenantErr || !tenant) {
    console.error("Tenant creation error:", tenantErr);
    return { error: tenantErr?.message ?? "Failed to create business" };
  }

  // 2. Insert user record
  const { error: userErr } = await adminClient.from("users").insert({
    id: user.id,
    tenant_id: tenant.id,
    email: user.email ?? "",
    full_name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email ??
      "Owner",
    role: "owner",
  });

  if (userErr) {
    console.error("User creation error:", userErr);
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
    console.error("Subscription creation error:", subErr);
    return { error: subErr.message };
  }

  // Seed default permissions for all roles
  try {
    await initDefaultPermissions(tenant.id);
  } catch {
    // Non-critical — continue
  }

  redirect("/dashboard");
}
