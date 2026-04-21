"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveSupportAccess,
  denySupportAccess,
  getSupportAccessByToken,
} from "@/lib/support-access";
import { sendSupportAccessApprovedEmail } from "@/lib/email/send";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";

export async function approveAccess(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // SECURITY: Reject unless there is an authenticated user. Previously
    // this action allowed an unauthenticated caller to approve with
    // `approvedBy = undefined`, which meant any customer who received a
    // phished /support-access/approve/{token} link could grant Nexpura
    // support full session-level access to the tenant. Auditing showed
    // `approved_by: NULL` rows — no way to identify the approver.
    if (!user?.id) {
      return { success: false, error: "You must be signed in as the tenant owner to approve support access." };
    }

    // Get the request to verify the user is the tenant owner
    const request = await getSupportAccessByToken(token);
    if (!request) {
      return { success: false, error: "Request not found" };
    }

    // Verify the user belongs to this tenant AND is the owner.
    const adminClient = createAdminClient();
    const { data: userRecord } = await adminClient
      .from("users")
      .select("id, tenant_id")
      .eq("id", user.id)
      .single();

    if (!userRecord || userRecord.tenant_id !== request.tenant_id) {
      return { success: false, error: "You must be signed in to the tenant that received this request." };
    }

    // Only owners can approve support access — sales/workshop/inventory
    // roles have no business granting data access to a third party.
    const { data: member } = await adminClient
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", request.tenant_id)
      .single();

    if (member?.role !== "owner") {
      return { success: false, error: "Only the tenant owner can approve support access." };
    }

    const result = await approveSupportAccess(token, user.id);
  
  if (!result.success) return result;

  // Send confirmation email to super admin
  const updatedRequest = await getSupportAccessByToken(token);
  if (updatedRequest) {
    const tenantData = updatedRequest.tenants as { business_name?: string; name?: string } | null;
    const businessName = tenantData?.business_name || tenantData?.name || "Unknown Business";
    
    await sendSupportAccessApprovedEmail({
      superAdminEmail: updatedRequest.requested_by_email,
      businessName,
      expiresAt: new Date(updatedRequest.expires_at!).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Australia/Sydney",
      }),
      tenantId: updatedRequest.tenant_id,
    });
  }

  revalidatePath("/admin");
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    logger.error("[approveAccess] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to approve access" };
  }
}

export async function denyAccess(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const result = await denySupportAccess(token, user?.id);
    
    if (!result.success) return result;

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    logger.error("[denyAccess] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to deny access" };
  }
}
