"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth-context";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function saveNotificationSettings(settings: {
  whatsapp_job_ready_enabled?: boolean;
  whatsapp_task_assignment_enabled?: boolean;
  notify_on_task_assignment?: boolean;
  notify_on_status_change?: boolean;
  notify_on_urgent_flagged?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    // Pre-fix any tenant member could rewrite these flags. They control
    // outbound customer-facing comms — owners + managers only.
    try {
      await requireRole("owner", "manager");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission_denied";
      return { error: msg.startsWith("permission_denied") ? "Only owner or manager can edit notification settings." : "Not authenticated" };
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Get current settings and merge
    const { data: tenant } = await admin
      .from("tenants")
      .select("notification_settings")
      .eq("id", userData.tenant_id)
      .single();

    const currentSettings = (tenant?.notification_settings as Record<string, unknown>) || {};
    const newSettings = { ...currentSettings, ...settings };

    const { error } = await admin
      .from("tenants")
      .update({
        notification_settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userData.tenant_id);

    if (error) return { error: error.message };

    revalidatePath("/settings/notifications");
    return { success: true };
  } catch (error) {
    logger.error("saveNotificationSettings failed", { error });
    return { error: "Operation failed" };
  }
}
