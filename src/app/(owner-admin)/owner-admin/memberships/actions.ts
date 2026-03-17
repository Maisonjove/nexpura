"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const OWNER_EMAIL = "germanijoey@yahoo.com";

// Helper to verify owner access
async function verifyOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || user.email !== OWNER_EMAIL) {
    throw new Error("Unauthorized: Owner access required");
  }
  
  return user;
}

// Request dashboard access for a tenant
export async function requestAccess(tenantId: string) {
  await verifyOwner();
  const admin = createAdminClient();

  // Check if there's already a pending or approved request
  const { data: existing } = await admin
    .from("owner_access_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "approved"])
    .single();

  if (existing) {
    if (existing.status === "approved") {
      // Check if still valid
      if (existing.expires_at && new Date(existing.expires_at) > new Date()) {
        throw new Error("Access already granted and still valid");
      }
    } else {
      throw new Error("Access request already pending");
    }
  }

  // Create new access request
  const { error } = await admin
    .from("owner_access_requests")
    .insert({
      tenant_id: tenantId,
      status: "pending",
      requested_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to create access request: ${error.message}`);
  }

  revalidatePath("/owner-admin/memberships");
  revalidatePath("/owner-admin/access-requests");
}

// Extend a subscription by adding free days
export async function extendSubscription(tenantId: string, days: number) {
  await verifyOwner();
  const admin = createAdminClient();

  // Get current subscription
  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (subError || !subscription) {
    throw new Error("Subscription not found");
  }

  // Calculate new end date
  const currentEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end) 
    : new Date();
  
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + days);

  // If trial, extend trial_ends_at as well
  let trialEndsAt = subscription.trial_ends_at;
  if (subscription.status === "trialing" && trialEndsAt) {
    const newTrialEnd = new Date(trialEndsAt);
    newTrialEnd.setDate(newTrialEnd.getDate() + days);
    trialEndsAt = newTrialEnd.toISOString();
  }

  // Update subscription
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      current_period_end: newEnd.toISOString(),
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (updateError) {
    throw new Error(`Failed to extend subscription: ${updateError.message}`);
  }

  revalidatePath("/owner-admin/memberships");
}

// Change subscription plan
export async function changePlan(tenantId: string, newPlan: string) {
  await verifyOwner();
  const admin = createAdminClient();

  const validPlans = ["boutique", "basic", "studio", "pro", "atelier", "group", "ultimate"];
  if (!validPlans.includes(newPlan)) {
    throw new Error("Invalid plan");
  }

  const { error } = await admin
    .from("subscriptions")
    .update({
      plan: newPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Failed to change plan: ${error.message}`);
  }

  revalidatePath("/owner-admin/memberships");
}

// Pause subscription
export async function pauseSubscription(tenantId: string) {
  await verifyOwner();
  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Failed to pause subscription: ${error.message}`);
  }

  revalidatePath("/owner-admin/memberships");
}

// Resume paused subscription
export async function resumeSubscription(tenantId: string) {
  await verifyOwner();
  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Failed to resume subscription: ${error.message}`);
  }

  revalidatePath("/owner-admin/memberships");
}

// Cancel subscription
export async function cancelSubscription(tenantId: string) {
  await verifyOwner();
  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }

  revalidatePath("/owner-admin/memberships");
}
