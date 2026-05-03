"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { admin, userId: user.id, tenantId: userData.tenant_id as string, role: (userData as { role?: string }).role ?? "staff" };
}

export async function setAutomationEnabled(
  automationId: string,
  enabled: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  let c;
  try { c = await ctx(); } catch (e) { return { error: e instanceof Error ? e.message : "Auth failed" }; }
  // Only owner/manager/admin can flip lifecycle automations.
  if (!["owner", "admin", "manager"].includes(c.role)) {
    return { error: "You don't have permission to change automations." };
  }

  const { error } = await c.admin
    .from("marketing_automations")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", automationId)
    .eq("tenant_id", c.tenantId);
  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: c.tenantId,
    userId: c.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: automationId,
    newData: { kind: "marketing_automation", enabled },
  });

  revalidatePath("/customers/automation");
  return { ok: true };
}
