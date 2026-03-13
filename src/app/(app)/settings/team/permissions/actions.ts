"use server";

import { createClient } from "@/lib/supabase/server";
import { updateRolePermission, type PermissionKey } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

async function getOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (userData?.role !== "owner") throw new Error("Only owners can update permissions");
  if (!userData.tenant_id) throw new Error("No tenant");

  return { tenantId: userData.tenant_id as string };
}

export async function updatePermission(
  tenantId: string,
  role: string,
  permissionKey: PermissionKey,
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  try {
    await getOwnerContext();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  const result = await updateRolePermission(tenantId, role, permissionKey, enabled);
  revalidatePath("/settings/team/permissions");
  return result;
}
