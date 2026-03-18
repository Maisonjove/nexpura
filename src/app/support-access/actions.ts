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

export async function approveAccess(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get the request to verify the user is the tenant owner
  const request = await getSupportAccessByToken(token);
  if (!request) {
    return { success: false, error: "Request not found" };
  }

  // Verify the user belongs to this tenant
  const adminClient = createAdminClient();
  const { data: userRecord } = await adminClient
    .from("users")
    .select("id, tenant_id")
    .eq("id", user?.id)
    .single();

  // Allow approval if: user is logged in and belongs to tenant, OR public access (for email links)
  const approvedBy = userRecord?.tenant_id === request.tenant_id ? user?.id : undefined;

  const result = await approveSupportAccess(token, approvedBy || request.tenant_id);
  
  if (!result.success) return result;

  // Send confirmation email to super admin
  const updatedRequest = await getSupportAccessByToken(token);
  if (updatedRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenantData = updatedRequest.tenants as any;
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
}

export async function denyAccess(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const result = await denySupportAccess(token, user?.id);
  
  if (!result.success) return result;

  revalidatePath("/admin");
  return { success: true };
}
