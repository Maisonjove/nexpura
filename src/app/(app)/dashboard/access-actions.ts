"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Approve an access request
export async function approveAccess(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const admin = createAdminClient();

  // Get user's tenant
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    throw new Error("Tenant not found");
  }

  // Verify the request belongs to this tenant
  const { data: request } = await admin
    .from("owner_access_requests")
    .select("*")
    .eq("id", requestId)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!request) {
    throw new Error("Access request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Request is no longer pending");
  }

  // Approve with 24 hour expiry
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { error } = await admin
    .from("owner_access_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(`Failed to approve access: ${error.message}`);
  }

  revalidatePath("/dashboard");
}

// Deny an access request
export async function denyAccess(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const admin = createAdminClient();

  // Get user's tenant
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    throw new Error("Tenant not found");
  }

  // Verify the request belongs to this tenant
  const { data: request } = await admin
    .from("owner_access_requests")
    .select("*")
    .eq("id", requestId)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!request) {
    throw new Error("Access request not found");
  }

  const { error } = await admin
    .from("owner_access_requests")
    .update({
      status: "denied",
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(`Failed to deny access: ${error.message}`);
  }

  revalidatePath("/dashboard");
}

// Revoke an approved access request
export async function revokeAccess(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const admin = createAdminClient();

  // Get user's tenant
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    throw new Error("Tenant not found");
  }

  // Verify the request belongs to this tenant
  const { data: request } = await admin
    .from("owner_access_requests")
    .select("*")
    .eq("id", requestId)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!request) {
    throw new Error("Access request not found");
  }

  const { error } = await admin
    .from("owner_access_requests")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(`Failed to revoke access: ${error.message}`);
  }

  revalidatePath("/dashboard");
}
