"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

async function verifyTenantOwnership(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profile?.tenant_id !== tenantId) {
    return { error: "Unauthorized" };
  }

  return {};
}

export async function saveBusinessProfile(tenantId: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const authCheck = await verifyTenantOwnership(supabase, tenantId);
    if (authCheck.error) return { error: authCheck.error };

    const { error } = await supabase
      .from("tenants")
      .update({
        business_name: formData.get("business_name") as string || null,
        business_type: formData.get("business_type") as string || null,
        business_mode: formData.get("business_mode") as string || 'full',
        phone: formData.get("phone") as string || null,
        email: formData.get("email") as string || null,
        website: formData.get("website") as string || null,
        abn: formData.get("abn") as string || null,
        address_line1: formData.get("address_line1") as string || null,
        suburb: formData.get("suburb") as string || null,
        state: formData.get("state") as string || null,
        postcode: formData.get("postcode") as string || null,
        country: formData.get("country") as string || null,
        invoice_accent_color: formData.get("invoice_accent_color") as string || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (error) return { error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("saveBusinessProfile failed", { error });
    return { error: "Operation failed" };
  }
}

export async function saveTaxCurrency(tenantId: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const authCheck = await verifyTenantOwnership(supabase, tenantId);
    if (authCheck.error) return { error: authCheck.error };

    const taxRatePercent = parseFloat(formData.get("tax_rate") as string) || 10;
    const { error } = await supabase
      .from("tenants")
      .update({
        currency: formData.get("currency") as string || "AUD",
        timezone: formData.get("timezone") as string || "Australia/Sydney",
        tax_name: formData.get("tax_name") as string || "GST",
        tax_rate: taxRatePercent / 100,
        tax_inclusive: formData.get("tax_inclusive") === "true",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (error) return { error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("saveTaxCurrency failed", { error });
    return { error: "Operation failed" };
  }
}

export async function saveBanking(tenantId: string, formData: FormData) {
  try {
    const supabase = await createClient();

    const authCheck = await verifyTenantOwnership(supabase, tenantId);
    if (authCheck.error) return { error: authCheck.error };

    const { error } = await supabase
      .from("tenants")
      .update({
        bank_name: formData.get("bank_name") as string || null,
        bank_bsb: formData.get("bank_bsb") as string || null,
        bank_account: formData.get("bank_account") as string || null,
        invoice_footer: formData.get("invoice_footer") as string || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (error) return { error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("saveBanking failed", { error });
    return { error: "Operation failed" };
  }
}

export async function saveAccount(userId: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("users")
      .update({
        full_name: formData.get("full_name") as string || null,
      })
      .eq("id", userId);

    if (error) return { error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("saveAccount failed", { error });
    return { error: "Operation failed" };
  }
}
