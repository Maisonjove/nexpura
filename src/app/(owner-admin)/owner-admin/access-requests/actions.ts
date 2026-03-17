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

// Request access again (for expired/denied/revoked requests)
export async function requestAccessAgain(tenantId: string) {
  await verifyOwner();
  const admin = createAdminClient();

  // Check if there's already a pending request
  const { data: existing } = await admin
    .from("owner_access_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .single();

  if (existing) {
    throw new Error("Access request already pending");
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
