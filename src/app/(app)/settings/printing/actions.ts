"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function savePrinterConfig(
  tenantId: string,
  config: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("printer_configs")
    .upsert(
      { tenant_id: tenantId, ...config },
      { onConflict: "tenant_id,printer_type" }
    );

  if (error) return { error: error.message };
  revalidatePath("/settings/printing");
  return { success: true };
}
