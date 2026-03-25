"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
