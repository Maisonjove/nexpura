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

export async function addBespokeLineItem(
  jobId: string,
  tenantId: string,
  item: { description: string; qty: number; unitPrice: number; inventoryId?: string }
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: jobRow } = await admin.from("bespoke_jobs").select("invoice_id, customer_id").eq("id", jobId).eq("tenant_id", tenantId).single();
  let invoiceId = jobRow?.invoice_id ?? null;

  if (!invoiceId) {
    const { data: inv, error: invErr } = await admin.from("invoices").insert({
      tenant_id: tenantId,
      invoice_number: `DRAFT-${Date.now()}`,
      customer_id: jobRow?.customer_id ?? null,
      reference_type: "bespoke",
      reference_id: jobId,
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
    await admin.from("bespoke_jobs").update({ invoice_id: invoiceId }).eq("id", jobId).eq("tenant_id", tenantId);
  }

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
    discount_pct: 0,
    total: item.unitPrice * item.qty,
  });
  if (liErr) return { error: liErr.message };

  await recalcInvoice(admin, invoiceId, taxRate);
  revalidatePath(`/bespoke/${jobId}`);
  return { success: true };
}

export async function removeBespokeLineItem(
  lineItemId: string,
  jobId: string,
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
  revalidatePath(`/bespoke/${jobId}`);
  return { success: true };
}

export async function recordBespokePayment(
  jobId: string,
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

  revalidatePath(`/bespoke/${jobId}`);
  return { success: true };
}

export async function generateBespokeInvoice(
  jobId: string,
  tenantId: string
): Promise<{ success?: boolean; invoiceId?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: job } = await admin.from("bespoke_jobs").select("customer_id, quoted_price, invoice_id").eq("id", jobId).eq("tenant_id", tenantId).single();
  if (!job) return { error: "Job not found" };
  if (job.invoice_id) return { success: true, invoiceId: job.invoice_id };

  const { data: inv, error } = await admin.from("invoices").insert({
    tenant_id: tenantId,
    invoice_number: `DRAFT-${Date.now()}`,
    customer_id: job.customer_id,
    reference_type: "bespoke",
    reference_id: jobId,
    status: "draft",
    invoice_date: new Date().toISOString().split("T")[0],
    subtotal: job.quoted_price ?? 0,
    tax_amount: (job.quoted_price ?? 0) * 0.1,
    discount_amount: 0,
    total: (job.quoted_price ?? 0) * 1.1,
    amount_paid: 0,
    tax_name: "GST",
    tax_rate: 0.1,
  }).select("id").single();
  if (error || !inv) return { error: error?.message ?? "Failed to create invoice" };

  await admin.from("bespoke_jobs").update({ invoice_id: inv.id }).eq("id", jobId).eq("tenant_id", tenantId);
  revalidatePath(`/bespoke/${jobId}`);
  return { success: true, invoiceId: inv.id };
}

export async function updateBespokeStage(
  jobId: string,
  tenantId: string,
  stage: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { supabase, admin, userId } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { error } = await supabase.from("bespoke_jobs").update({ stage, updated_at: new Date().toISOString() }).eq("id", jobId).eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  await admin.from("bespoke_job_stages").insert({ tenant_id: tenantId, job_id: jobId, stage, notes: null, created_by: userId });
  revalidatePath(`/bespoke/${jobId}`);
  return { success: true };
}
