"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function updateEnquiryStatus(
  enquiryId: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "No tenant" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("shop_enquiries")
      .update({ status })
      .eq("id", enquiryId)
      .eq("tenant_id", userData.tenant_id);

    if (error) return { error: error.message };
    revalidatePath("/enquiries");
    return { success: true };
  } catch (error) {
    logger.error("updateEnquiryStatus failed", { error });
    return { error: "Operation failed" };
  }
}
