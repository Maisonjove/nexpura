"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, admin: createAdminClient(), userId: user.id, tenantId: userData.tenant_id };
}

function generateVoucherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GV-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getVouchers() {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { data: null, error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;
  const { data, error } = await admin
    .from("gift_vouchers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getVoucherById(id: string) {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { data: null, error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;
  const { data: voucher, error } = await admin
    .from("gift_vouchers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  if (error || !voucher) return { data: null, error: error?.message ?? "Not found" };
  const { data: redemptions } = await admin
    .from("gift_voucher_redemptions")
    .select("*")
    .eq("voucher_id", id)
    .order("created_at", { ascending: false });
  return { data: { ...voucher, redemptions: redemptions ?? [] }, error: null };
}

export async function createVoucher(formData: FormData): Promise<{ id?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, userId, tenantId } = ctx;

  const amount = parseFloat(formData.get("amount") as string) || 0;
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  // Ensure unique code
  let code = formData.get("custom_code") as string || generateVoucherCode();
  const { data: existing } = await admin
    .from("gift_vouchers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .maybeSingle();
  if (existing) {
    code = generateVoucherCode();
  }

  const expiresAt = formData.get("expires_at") as string || null;
  const { data: voucher, error } = await admin
    .from("gift_vouchers")
    .insert({
      tenant_id: tenantId,
      code,
      original_amount: amount,
      balance: amount,
      issued_to_name: (formData.get("issued_to_name") as string) || null,
      issued_to_email: (formData.get("issued_to_email") as string) || null,
      issued_by: userId,
      expires_at: expiresAt || null,
      notes: (formData.get("notes") as string) || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !voucher) return { error: error?.message ?? "Failed to create voucher" };
  redirect(`/vouchers/${voucher.id}`);
}

export async function lookupVoucher(code: string): Promise<{
  data?: { id: string; code: string; balance: number; status: string; expires_at: string | null };
  error?: string;
}> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;
  const { data, error } = await admin
    .from("gift_vouchers")
    .select("id, code, balance, status, expires_at")
    .eq("tenant_id", tenantId)
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Voucher not found" };
  if (data.status !== "active") return { error: `Voucher is ${data.status}` };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { error: "Voucher has expired" };
  if (data.balance <= 0) return { error: "Voucher has no remaining balance" };
  return { data };
}

export async function voidVoucher(id: string): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;
  const { error } = await admin
    .from("gift_vouchers")
    .update({ status: "voided" })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  redirect("/vouchers");
}
