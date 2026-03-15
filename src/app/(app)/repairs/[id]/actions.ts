"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, admin, userId: user.id, tenantId: userData.tenant_id };
}

async function recalcInvoice(admin: ReturnType<typeof createAdminClient>, invoiceId: string, taxRate: number) {
  const { data: items } = await admin
    .from("invoice_line_items")
    .select("quantity, unit_price")
    .eq("invoice_id", invoiceId);
  const subtotal = (items ?? []).reduce((s, i) => s + (i.quantity ?? 1) * (i.unit_price ?? 0), 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  await admin.from("invoices").update({ subtotal, tax_amount: taxAmount, total }).eq("id", invoiceId);
}

export async function addRepairLineItem(
  repairId: string,
  tenantId: string,
  item: { description: string; qty: number; unitPrice: number; inventoryId?: string }
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  // Get or create invoice
  const { data: repairRow } = await admin.from("repairs").select("invoice_id").eq("id", repairId).eq("tenant_id", tenantId).single();
  let invoiceId = repairRow?.invoice_id ?? null;

  if (!invoiceId) {
    // Auto-create draft invoice
    const { data: inv, error: invErr } = await admin.from("invoices").insert({
      tenant_id: tenantId,
      invoice_number: `DRAFT-${Date.now()}`,
      customer_id: null,
      reference_type: "repair",
      reference_id: repairId,
      status: "draft",
      invoice_date: new Date().toISOString().split("T")[0],
      subtotal: 0,
      tax_amount: 0,
      discount_amount: 0,
      total: 0,
      amount_paid: 0,
      tax_name: "GST",
      tax_rate: 0.1,
    }).select("id").single();
    if (invErr || !inv) return { error: invErr?.message ?? "Failed to create invoice" };
    invoiceId = inv.id;
    // Link customer from repair
    const { data: repairFull } = await admin.from("repairs").select("customer_id").eq("id", repairId).single();
    await admin.from("invoices").update({ customer_id: repairFull?.customer_id }).eq("id", invoiceId);
    await admin.from("repairs").update({ invoice_id: invoiceId }).eq("id", repairId).eq("tenant_id", tenantId);
  }

  // Get tax rate
  const { data: invRow } = await admin.from("invoices").select("tax_rate").eq("id", invoiceId).single();
  const taxRate = invRow?.tax_rate ?? 0.1;

  // Insert line item
  const { error: liErr } = await admin.from("invoice_line_items").insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    description: item.description,
    inventory_id: item.inventoryId ?? null,
    quantity: item.qty,
    unit_price: item.unitPrice,
  });
  if (liErr) return { error: liErr.message };

  await recalcInvoice(admin, invoiceId, taxRate);
  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}

export async function removeRepairLineItem(
  lineItemId: string,
  repairId: string,
  tenantId: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: li } = await admin.from("invoice_line_items").select("invoice_id").eq("id", lineItemId).single();
  if (!li?.invoice_id) return { error: "Line item not found" };

  const { error } = await admin.from("invoice_line_items").delete().eq("id", lineItemId);
  if (error) return { error: error.message };

  const { data: invRow } = await admin.from("invoices").select("tax_rate").eq("id", li.invoice_id).single();
  await recalcInvoice(admin, li.invoice_id, invRow?.tax_rate ?? 0.1);
  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}

export async function recordRepairPayment(
  repairId: string,
  invoiceId: string,
  tenantId: string,
  amount: number,
  method: string,
  notes: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { error: payErr } = await admin.from("payments").insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    amount,
    payment_method: method,
    payment_date: new Date().toISOString().split("T")[0],
    notes: notes || null,
  });
  if (payErr) return { error: payErr.message };

  // Recalc amount_paid
  const { data: payments } = await admin.from("payments").select("amount").eq("invoice_id", invoiceId);
  const totalPaid = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const { data: invRow } = await admin.from("invoices").select("total").eq("id", invoiceId).single();
  const invTotal = invRow?.total ?? 0;

  const newStatus = totalPaid >= invTotal ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
  await admin.from("invoices").update({
    amount_paid: totalPaid,
    status: newStatus,
    ...(newStatus === "paid" ? { paid_at: new Date().toISOString() } : {}),
  }).eq("id", invoiceId);

  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}

export async function generateRepairInvoice(
  repairId: string,
  tenantId: string
): Promise<{ success?: boolean; invoiceId?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: repair } = await admin.from("repairs").select("customer_id, quoted_price, invoice_id").eq("id", repairId).eq("tenant_id", tenantId).single();
  if (!repair) return { error: "Repair not found" };
  if (repair.invoice_id) return { success: true, invoiceId: repair.invoice_id };

  const { data: inv, error } = await admin.from("invoices").insert({
    tenant_id: tenantId,
    invoice_number: `DRAFT-${Date.now()}`,
    customer_id: repair.customer_id,
    reference_type: "repair",
    reference_id: repairId,
    status: "draft",
    invoice_date: new Date().toISOString().split("T")[0],
    subtotal: repair.quoted_price ?? 0,
    tax_amount: (repair.quoted_price ?? 0) * 0.1,
    discount_amount: 0,
    total: (repair.quoted_price ?? 0) * 1.1,
    amount_paid: 0,
    tax_name: "GST",
    tax_rate: 0.1,
  }).select("id").single();
  if (error || !inv) return { error: error?.message ?? "Failed to create invoice" };

  await admin.from("repairs").update({ invoice_id: inv.id }).eq("id", repairId).eq("tenant_id", tenantId);
  revalidatePath(`/repairs/${repairId}`);
  return { success: true, invoiceId: inv.id };
}

export async function updateRepairStage(
  repairId: string,
  tenantId: string,
  stage: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { supabase, admin, userId } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { error } = await supabase.from("repairs").update({ stage, updated_at: new Date().toISOString() }).eq("id", repairId).eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  await admin.from("repair_stages").insert({ tenant_id: tenantId, repair_id: repairId, stage, notes: null, created_by: userId });
  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}
