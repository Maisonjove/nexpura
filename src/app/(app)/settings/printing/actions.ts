"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { requireRole } from "@/lib/auth-context";

export async function savePrinterConfig(
  tenantId: string,
  config: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Group 15 audit: printer config controls receipt + label output
    // for every staff member in the tenant. Pre-fix this had no role
    // gate — a salesperson could re-route receipts to a different
    // printer or change templates. Now owner+manager only, matching
    // /settings/tags + /settings/task-templates.
    let authCtx;
    try {
      authCtx = await requireRole("owner", "manager");
    } catch {
      return { error: "Only owner or manager can update printer config." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Defence-in-depth: ignore the caller-supplied tenantId if it
    // doesn't match the session tenant. Also retains the existing
    // verifyTenantOwnership-style check so the parameter shape doesn't
    // change for callers.
    if (tenantId && tenantId !== authCtx.tenantId) {
      return { error: "Unauthorized" };
    }
    const effectiveTenantId = authCtx.tenantId;

    const admin = createAdminClient();
    const { error } = await admin
      .from("printer_configs")
      .upsert(
        { tenant_id: effectiveTenantId, ...config },
        { onConflict: "tenant_id,printer_type" }
      );

    if (error) return { error: error.message };
    revalidatePath("/settings/printing");
    return { success: true };
  } catch (error) {
    logger.error("savePrinterConfig failed", { error });
    return { error: "Operation failed" };
  }
}
