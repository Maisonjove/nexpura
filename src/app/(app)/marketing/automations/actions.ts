"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function updateAutomation(
  automationType: string,
  data: { enabled?: boolean; settings?: Record<string, unknown>; template_id?: string | null }
) {
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

    // Check if automation exists, if not create it
    const { data: existing } = await admin
      .from("marketing_automations")
      .select("id")
      .eq("tenant_id", userData.tenant_id)
      .eq("automation_type", automationType)
      .single();

    if (existing) {
      // Update existing
      const { error } = await admin
        .from("marketing_automations")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) return { error: error.message };
    } else {
      // Create new
      const { error } = await admin.from("marketing_automations").insert({
        tenant_id: userData.tenant_id,
        automation_type: automationType,
        enabled: data.enabled ?? false,
        settings: data.settings ?? {},
        template_id: data.template_id ?? null,
      });

      if (error) return { error: error.message };
    }

    revalidatePath("/marketing/automations");
    return { success: true };
  } catch (error) {
    logger.error("updateAutomation failed", { error });
    return { error: "Operation failed" };
  }
}

export async function toggleAutomation(automationType: string, enabled: boolean) {
  try {
    return await updateAutomation(automationType, { enabled });
  } catch (error) {
    logger.error("toggleAutomation failed", { error });
    return { error: "Operation failed" };
  }
}
