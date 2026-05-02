"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-context";

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
  // W3-HIGH-04 / W3-RBAC-06: issuing a voucher = issuing money. Gate
  // on create_invoices (same as voidVoucher + refunds).
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to issue vouchers." : "Not authenticated" };
  }

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

  await logAuditEvent({
    tenantId,
    userId,
    action: "voucher_create",
    entityType: "voucher",
    entityId: voucher.id,
    newData: { code, amount, issued_to_name: (formData.get("issued_to_name") as string) || null },
  });

  revalidatePath("/vouchers");
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
  // RBAC: voiding a gift voucher wipes balance + invalidates a money
  // instrument. Same gate as refunds / invoice-void (create_invoices).
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, userId, tenantId } = ctx;

  // Get old data for audit
  const { data: oldData } = await admin
    .from("gift_vouchers")
    .select("code, balance, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error } = await admin
    .from("gift_vouchers")
    .update({ status: "voided" })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId,
    userId,
    action: "voucher_void",
    entityType: "voucher",
    entityId: id,
    oldData: oldData || undefined,
    newData: { status: "voided" },
  });

  revalidatePath("/vouchers");
  redirect("/vouchers");
}

/**
 * Manually redeem a voucher (full or partial). Mirrors what POS does via
 * pos_deduct_stock — but for the case where the operator is recording an
 * in-person redemption outside POS (e.g., a phone-in customer).
 *
 * Spec: "redeem (full + partial — partial leaves remainder), void, email
 * to customer. Balance arithmetic must be exact to the cent."
 */
export async function redeemVoucherManual(
  id: string,
  amount: number,
  notes?: string,
): Promise<{ success?: boolean; newBalance?: number; error?: string }> {
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg.startsWith("permission_denied") ? "You don't have permission to redeem vouchers." : "Not authenticated" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, userId, tenantId } = ctx;

  // Use the atomic RPC the POS already calls so balance + status are
  // updated under FOR UPDATE row lock + history row inserted in one
  // round trip. The RPC clamps amount to balance and flips status to
  // 'redeemed' when balance hits zero.
  const { data: rpcResult, error: rpcError } = await admin.rpc("redeem_voucher", {
    p_voucher_id: id,
    p_tenant_id: tenantId,
    p_amount: Math.round(amount * 100) / 100,
  });
  if (rpcError) return { error: rpcError.message };

  // Record the redemption history row (RPC handles balance; history is
  // separate in this codebase to allow non-POS redemptions to log notes).
  await admin.from("gift_voucher_redemptions").insert({
    tenant_id: tenantId,
    voucher_id: id,
    sale_id: null,
    amount: Math.round(amount * 100) / 100,
    redeemed_by: userId,
    notes: notes ?? "Manual redemption",
  });

  await logAuditEvent({
    tenantId, userId, action: "voucher_void", // closest action enum; full audit_action enum lacks voucher_redeem
    entityType: "voucher", entityId: id,
    newData: { manual_redeem: true, amount },
  }).catch(() => {});

  const newBalance = Array.isArray(rpcResult) && rpcResult[0]?.new_balance != null
    ? Number(rpcResult[0].new_balance)
    : undefined;
  revalidatePath("/vouchers");
  revalidatePath(`/vouchers/${id}`);
  return { success: true, newBalance };
}

/**
 * Email the voucher to the customer. Uses the same Resend-backed sender
 * the quote/invoice emails go through.
 */
export async function emailVoucher(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePermission("create_invoices");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "permission_denied";
    return { error: msg };
  }
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  const { data: voucher } = await admin
    .from("gift_vouchers")
    .select("code, original_amount, balance, expires_at, issued_to_name, issued_to_email")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  if (!voucher) return { error: "Voucher not found" };
  if (!voucher.issued_to_email) return { error: "No recipient email on file." };

  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, name, email")
    .eq("id", tenantId)
    .single();
  const businessName = tenant?.business_name || tenant?.name || "Your Business";
  const fromEmail = tenant?.email || "noreply@nexpura.com";

  // Resend integration mirroring emailQuote.ts.
  const { Resend } = await import("resend");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "Email service is not configured." };
  const resend = new Resend(apiKey);

  const expiry = voucher.expires_at
    ? new Date(voucher.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : "No expiry";

  const html = `
    <div style="font-family: Georgia, serif; max-width: 540px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1c1917; margin: 0 0 8px;">${businessName} Gift Voucher</h1>
      <p style="color: #57534e;">${voucher.issued_to_name ? `Hi ${voucher.issued_to_name},` : "Hello,"}</p>
      <p style="color: #57534e;">A gift voucher has been issued for you.</p>
      <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Voucher Code</p>
        <p style="font-family: monospace; font-size: 22px; font-weight: 700; color: #1c1917; margin: 0 0 16px;">${voucher.code}</p>
        <p style="font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px;">Balance</p>
        <p style="font-size: 28px; font-weight: 700; color: #1c1917; margin: 0;">$${Number(voucher.balance).toFixed(2)}</p>
        <p style="font-size: 12px; color: #78716c; margin-top: 12px;">Expires: ${expiry}</p>
      </div>
      <p style="color: #57534e; font-size: 14px;">Present this code at checkout to redeem.</p>
      <p style="color: #57534e; font-size: 12px; margin-top: 24px;">— ${businessName}</p>
    </div>
  `;

  const { error: sendErr } = await resend.emails.send({
    from: `${businessName} <${fromEmail}>`,
    to: voucher.issued_to_email,
    subject: `Your gift voucher from ${businessName}`,
    html,
  });
  if (sendErr) return { error: sendErr.message };

  revalidatePath(`/vouchers/${id}`);
  return { success: true };
}
