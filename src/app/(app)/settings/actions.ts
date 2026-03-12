"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveBusinessProfile(tenantId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      business_name: formData.get("business_name") as string || null,
      business_type: formData.get("business_type") as string || null,
      phone: formData.get("phone") as string || null,
      email: formData.get("email") as string || null,
      website: formData.get("website") as string || null,
      abn: formData.get("abn") as string || null,
      address_line1: formData.get("address_line1") as string || null,
      suburb: formData.get("suburb") as string || null,
      state: formData.get("state") as string || null,
      postcode: formData.get("postcode") as string || null,
      country: formData.get("country") as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveTaxCurrency(tenantId: string, formData: FormData) {
  const supabase = await createClient();
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
}

export async function saveBanking(tenantId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      bank_name: formData.get("bank_name") as string || null,
      bank_bsb: formData.get("bank_bsb") as string || null,
      bank_account: formData.get("bank_account") as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveAccount(userId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name: formData.get("full_name") as string || null,
    })
    .eq("id", userId);

  if (error) return { error: error.message };
  return { success: true };
}
