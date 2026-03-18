"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTenantAccessRequests,
  revokeSupportAccess,
} from "@/lib/support-access";
import { revalidatePath } from "next/cache";

export async function getAccessRequests(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Verify user belongs to this tenant
  const adminClient = createAdminClient();
  const { data: userRecord } = await adminClient
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userRecord || userRecord.tenant_id !== tenantId) return [];

  return getTenantAccessRequests(tenantId);
}

export async function revokeAccess(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthenticated" };

  // Get the request to verify ownership
  const adminClient = createAdminClient();
  const { data: request } = await adminClient
    .from("support_access_requests")
    .select("tenant_id")
    .eq("id", requestId)
    .single();

  if (!request) return { success: false, error: "Request not found" };

  // Verify user belongs to this tenant
  const { data: userRecord } = await adminClient
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userRecord || userRecord.tenant_id !== request.tenant_id) {
    return { success: false, error: "Unauthorized" };
  }

  // Only owners can revoke
  if (userRecord.role !== "owner") {
    return { success: false, error: "Only account owners can revoke support access" };
  }

  const result = await revokeSupportAccess(requestId, user.id);

  if (result.success) {
    revalidatePath("/settings");
  }

  return result;
}
