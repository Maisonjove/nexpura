"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { withIdempotency, createPaymentFingerprint } from "@/lib/idempotency";
import { generateDraftInvoiceNumber } from "@/lib/invoices/draft-number";
import logger from "@/lib/logger";
import { assertTenantActive } from "@/lib/assert-tenant-active";
import { requireAuth, requirePermission } from "@/lib/auth-context";
import { resend } from "@/lib/email/resend";

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
  // Paywall choke point.
  await assertTenantActive(userData.tenant_id);
  return { supabase, admin, userId: user.id, tenantId: userData.tenant_id };
}

// Permission-gated variant: used by mutations that edit a bespoke job
// (line items, payments, stage transitions). Rejects if the authed user
// lacks `edit_bespoke`. Owners pass automatically. Audit finding (High):
// these actions previously only checked auth + tenant match, so a
// salesperson with no bespoke edit rights could hit them via the
// network tab.
async function requireBespokeEditContext() {
  await requirePermission("edit_bespoke");
  return getAuthContext();
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
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: jobRow } = await admin.from("bespoke_jobs").select("invoice_id, customer_id").eq("id", jobId).eq("tenant_id", tenantId).single();
  let invoiceId = jobRow?.invoice_id ?? null;

  if (!invoiceId) {
    const { data: inv, error: invErr } = await admin.from("invoices").insert({
      tenant_id: tenantId,
      invoice_number: generateDraftInvoiceNumber(),
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
  // RBAC: line-item removal on a shared bespoke job mutates a customer
  // invoice. Owner/manager only — matches removeRepairLineItem.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can remove bespoke line items." };
    }
  } catch {
    return { error: "Not authenticated" };
  }
  let ctx;
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
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
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  // IDEMPOTENCY: Prevent duplicate payment submissions
  const paymentDate = new Date().toISOString().split("T")[0];
  const fingerprint = createPaymentFingerprint(amount, method, paymentDate);
  const result = await withIdempotency(
    "bespoke_payment",
    tenantId,
    invoiceId,
    fingerprint,
    async () => {
      // Check invoice status before inserting payment
      const { data: invCheck } = await admin.from("invoices").select("status, total").eq("id", invoiceId).single();
      if (!invCheck) return { error: "Invoice not found" };
      if (invCheck.status === "voided") return { error: "Cannot record payment on voided invoice" };

      const { error: payErr } = await admin.from("payments").insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        amount,
        payment_method: method,
        payment_date: paymentDate,
        notes: notes || null,
      });
      if (payErr) return { error: payErr.message };

      // ATOMIC: recalculate from all payments (race-safe)
      const { data: payments } = await admin.from("payments").select("amount").eq("invoice_id", invoiceId);
      const totalPaid = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
      const invTotal = invCheck.total ?? 0;

      const newStatus = totalPaid >= invTotal ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
      await admin.from("invoices").update({
        amount_paid: totalPaid,
        status: newStatus,
        ...(newStatus === "paid" ? { paid_at: new Date().toISOString() } : {}),
      }).eq("id", invoiceId);

      return { success: true };
    }
  );

  if ("duplicate" in result && result.duplicate) {
    return { error: result.error };
  }

  revalidatePath(`/bespoke/${jobId}`);
  revalidatePath("/dashboard");
  return result as { success?: boolean; error?: string };
}

export async function generateBespokeInvoice(
  jobId: string,
  tenantId: string
): Promise<{ success?: boolean; invoiceId?: string; error?: string }> {
  let ctx;
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { admin } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { data: job } = await admin.from("bespoke_jobs").select("customer_id, quoted_price, invoice_id").eq("id", jobId).eq("tenant_id", tenantId).single();
  if (!job) return { error: "Job not found" };
  if (job.invoice_id) return { success: true, invoiceId: job.invoice_id };

  const { data: inv, error } = await admin.from("invoices").insert({
    tenant_id: tenantId,
    invoice_number: generateDraftInvoiceNumber(),
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
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { supabase, admin, userId } = ctx;
  if (ctx.tenantId !== tenantId) return { error: "Unauthorized" };

  const { error } = await supabase.from("bespoke_jobs").update({ stage, updated_at: new Date().toISOString() }).eq("id", jobId).eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  await admin.from("bespoke_job_stages").insert({ tenant_id: tenantId, job_id: jobId, stage, notes: null, created_by: userId });

  // Log stage change event
  const stageLabel = stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "bespoke",
    job_id: jobId,
    event_type: "stage_change",
    description: `Stage changed to ${stageLabel}`,
    actor: ctx.userId,
  });

  revalidatePath(`/bespoke/${jobId}`);
  return { success: true };
}

export async function emailBespokeInvoice(
  jobId: string,
  invoiceId: string
): Promise<{ success?: boolean; note?: string; message?: string; error?: string }> {
  let ctx;
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { admin, tenantId } = ctx;

  // Fetch tenant info for dynamic branding
  const { data: tenant } = await admin.from("tenants").select("name, business_name, email, phone, address_line1, suburb, state, postcode").eq("id", tenantId).single();
  const businessName = tenant?.business_name || tenant?.name || "Your Jeweller";
  const businessAddress = [tenant?.address_line1, tenant?.suburb, tenant?.state, tenant?.postcode].filter(Boolean).join(", ");
  const businessEmail = tenant?.email || "";

  const { data: job } = await admin.from("bespoke_jobs").select("job_number, title, customer_id").eq("id", jobId).eq("tenant_id", tenantId).single();
  if (!job) return { error: "Job not found" };

  const { data: customer } = job.customer_id
    ? await admin.from("customers").select("full_name, email").eq("id", job.customer_id).single()
    : { data: null };

  if (!customer?.email) return { error: "Customer has no email address" };

  const { data: invoice } = await admin.from("invoices").select("invoice_number, total, amount_paid, subtotal, tax_amount, status, due_date").eq("id", invoiceId).single();
  if (!invoice) return { error: "Invoice not found" };

  const { data: lineItems } = await admin.from("invoice_line_items").select("description, quantity, unit_price").eq("invoice_id", invoiceId);

  const balanceDue = Math.max(0, (invoice.total ?? 0) - (invoice.amount_paid ?? 0));
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const lineItemsHtml = (lineItems ?? []).map((li) =>
    `<tr><td style="padding:4px 8px;border:1px solid #eee;">${li.description}</td><td style="padding:4px 8px;border:1px solid #eee;text-align:right;">${li.quantity}</td><td style="padding:4px 8px;border:1px solid #eee;text-align:right;">${fmt(li.unit_price)}</td><td style="padding:4px 8px;border:1px solid #eee;text-align:right;">${fmt((li.quantity ?? 1) * (li.unit_price ?? 0))}</td></tr>`
  ).join("");

  const htmlBody = `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1c1917;">
  <div style="background:#1c1917;color:#fff;padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">${businessName}</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#d6d3d1;">Invoice ${invoice.invoice_number}</p>
  </div>
  <div style="padding:24px;background:#fafaf9;">
    <p>Hi ${customer.full_name},</p>
    <p>Please find your invoice below for your bespoke commission: <strong>${job.title}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:4px 8px;border:1px solid #eee;text-align:left;">Description</th>
          <th style="padding:4px 8px;border:1px solid #eee;text-align:right;">Qty</th>
          <th style="padding:4px 8px;border:1px solid #eee;text-align:right;">Unit</th>
          <th style="padding:4px 8px;border:1px solid #eee;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>
    <div style="text-align:right;margin-top:8px;">
      <div>Subtotal: ${fmt(invoice.subtotal ?? 0)}</div>
      <div>GST (10%): ${fmt(invoice.tax_amount ?? 0)}</div>
      <div style="font-size:16px;font-weight:bold;margin-top:4px;">Total: ${fmt(invoice.total ?? 0)}</div>
      <div>Paid: ${fmt(invoice.amount_paid ?? 0)}</div>
      <div style="font-weight:bold;color:${balanceDue > 0 ? "#b45309" : "#1c1917"};">Balance Due: ${fmt(balanceDue)}</div>
    </div>
  </div>
  <div style="padding:16px 24px;background:#fff;text-align:center;font-size:12px;color:#78716c;">
    ${businessName}${businessAddress ? ` · ${businessAddress}` : ""}${businessEmail ? ` · ${businessEmail}` : ""}
  </div>
</div>`;

  // Use tenant's configured from email, or fall back to nexpura.com domain
  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@nexpura.com";
  // W2-001: route through the sandbox-aware `resend` wrapper; the old raw
  // fetch bypassed `isSandbox()` and could hit Resend from preview/dev.
  const { error: sendError } = await resend.emails.send({
    from: `${businessName} <${fromEmail}>`,
    to: [customer.email],
    subject: `Invoice ${invoice.invoice_number} — ${businessName}`,
    html: htmlBody,
  });

  if (sendError) {
    logger.error("Resend error:", sendError);
    // Demo-limited: log event but don't surface as error
    try {
      await admin.from("job_events").insert({
        tenant_id: tenantId,
        job_type: "bespoke",
        job_id: jobId,
        event_type: "email_attempted",
        description: `Invoice email attempted (demo mode — verify sending domain for external delivery)`,
        actor: ctx.userId,
      });
    } catch { /* ignore */ }
    revalidatePath(`/bespoke/${jobId}`);
    return { success: true, note: "demo_limited", message: "Email logged — configure a verified sending domain in Settings for external delivery" };
  }

  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "bespoke",
    job_id: jobId,
    event_type: "email_sent",
    description: `Invoice ${invoice.invoice_number} emailed to ${customer.email} ✓`,
    actor: ctx.userId,
  });

  revalidatePath(`/bespoke/${jobId}`);
  return { success: true, note: "sent", message: `Invoice emailed to ${customer.email}` };
}

export async function uploadJobAttachment(
  jobType: "repair" | "bespoke",
  jobId: string,
  fileUrl: string,
  fileName: string,
  caption: string | null
): Promise<{ success?: boolean; id?: string; error?: string }> {
  let ctx;
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { admin, tenantId } = ctx;

  const { data, error } = await admin.from("job_attachments").insert({
    tenant_id: tenantId,
    job_type: jobType,
    job_id: jobId,
    file_name: fileName,
    file_url: fileUrl,
    caption: caption ?? null,
  }).select("id").single();

  if (error) return { error: error.message };
  return { success: true, id: data?.id };
}

export async function deleteJobAttachment(
  attachmentId: string,
  jobType: "repair" | "bespoke",
  jobId: string
): Promise<{ success?: boolean; error?: string }> {
  // RBAC: attachments can contain signed forms, customer IDs, and
  // evidence. Deletion on shared job entities is owner/manager only.
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete job attachments." };
    }
  } catch {
    return { error: "Not authenticated" };
  }
  let ctx;
  try { ctx = await requireBespokeEditContext(); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("permission_denied:")) return { error: "You don't have permission to edit bespoke jobs." };
    if (msg === "subscription_required") return { error: "Your subscription is inactive. Please update billing to continue." };
    return { error: "Not authenticated" };
  }
  const { admin, tenantId } = ctx;

  const { error } = await admin.from("job_attachments").delete().eq("id", attachmentId).eq("tenant_id", tenantId).eq("job_type", jobType).eq("job_id", jobId);
  if (error) return { error: error.message };
  return { success: true };
}
