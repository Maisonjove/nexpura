"use server";

import { createClient } from "@/lib/supabase/server";
import { updateRolePermission, type PermissionKey } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { after } from "next/server";

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

  return { userId: user.id, tenantId: userData.tenant_id as string };
}

export async function updatePermission(
  tenantId: string,
  role: string,
  permissionKey: PermissionKey,
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await getOwnerContext();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }

  const result = await updateRolePermission(tenantId, role, permissionKey, enabled);
  if (result.success) {
    // Audit: who granted/revoked which permission for which role.
    // Finding #9 of the HIGH audit list: this mutation was previously
    // untraceable, so a dispute over "who took away my refund rights?"
    // had no answer.
    after(() =>
      logAuditEvent({
        tenantId,
        userId: ctx!.userId,
        action: "settings_update",
        entityType: "settings",
        entityId: `role_permission:${role}:${permissionKey}`,
        newData: { role, permissionKey, enabled },
      }),
    );
  }
  revalidatePath("/settings/team/permissions");
  return result;
}
