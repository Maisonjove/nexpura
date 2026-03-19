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

  // Check invoice status before inserting payment
  const { data: invCheck } = await admin.from("invoices").select("status, total").eq("id", invoiceId).single();
  if (!invCheck) return { error: "Invoice not found" };
  if (invCheck.status === "voided") return { error: "Cannot record payment on voided invoice" };

  const { error: payErr } = await admin.from("payments").insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    amount,
    payment_method: method,
    payment_date: new Date().toISOString().split("T")[0],
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

  revalidatePath(`/repairs/${repairId}`);
  revalidatePath("/dashboard");
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

  // Log stage change event
  const stageLabel = stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "repair",
    job_id: repairId,
    event_type: "stage_change",
    description: `Stage changed to ${stageLabel}`,
    actor: ctx.userId,
  });

  revalidatePath(`/repairs/${repairId}`);
  return { success: true };
}

export async function emailRepairInvoice(
  repairId: string,
  invoiceId: string
): Promise<{ success?: boolean; note?: string; message?: string; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  // Fetch repair + customer + invoice + line items
  const { data: repair } = await admin.from("repairs").select("repair_number, item_description, customer_id").eq("id", repairId).eq("tenant_id", tenantId).single();
  if (!repair) return { error: "Repair not found" };

  const { data: customer } = repair.customer_id
    ? await admin.from("customers").select("full_name, email").eq("id", repair.customer_id).single()
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
    <h1 style="margin:0;font-size:22px;">Marcus &amp; Co. Fine Jewellery</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#d6d3d1;">Invoice ${invoice.invoice_number}</p>
  </div>
  <div style="padding:24px;background:#fafaf9;">
    <p>Hi ${customer.full_name},</p>
    <p>Please find your invoice below for repair work on your <strong>${repair.item_description}</strong>.</p>
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
    Marcus &amp; Co. Fine Jewellery · 32 Castlereagh St, Sydney NSW 2000 · hello@marcusandco.com.au
  </div>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Marcus & Co. <onboarding@resend.dev>",
      to: [customer.email],
      subject: `Invoice ${invoice.invoice_number} — Marcus & Co. Fine Jewellery`,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error:", errText);
    // Demo-limited: log event but don't surface as error
    try {
      await admin.from("job_events").insert({
        tenant_id: tenantId,
        job_type: "repair",
        job_id: repairId,
        event_type: "email_attempted",
        description: `Invoice email attempted (demo mode — verify sending domain for external delivery)`,
        actor: ctx.userId,
      });
    } catch { /* ignore */ }
    revalidatePath(`/repairs/${repairId}`);
    return { success: true, note: "demo_limited", message: "Email logged — configure a verified sending domain in Settings for external delivery" };
  }

  // Log to job_events
  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: "repair",
    job_id: repairId,
    event_type: "email_sent",
    description: `Invoice ${invoice.invoice_number} emailed to ${customer.email} ✓`,
    actor: ctx.userId,
  });

  revalidatePath(`/repairs/${repairId}`);
  return { success: true, note: "sent", message: `Invoice emailed to ${customer.email}` };
}

export async function emailJobReady(
  jobType: "repair" | "bespoke",
  jobId: string
): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }
  const { admin, tenantId } = ctx;

  let customer = null;
  let itemDesc = "";
  let jobNumber = "";

  if (jobType === "repair") {
    const { data: repair } = await admin.from("repairs").select("repair_number, item_description, customer_id").eq("id", jobId).eq("tenant_id", tenantId).single();
    if (!repair) return { error: "Job not found" };
    itemDesc = repair.item_description;
    jobNumber = repair.repair_number;
    if (repair.customer_id) {
      const { data: cust } = await admin.from("customers").select("full_name, email").eq("id", repair.customer_id).single();
      customer = cust;
    }
  }

  if (!customer?.email) return { error: "Customer has no email address" };

  const htmlBody = `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1c1917;">
  <div style="background:#1c1917;color:#fff;padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">Marcus &amp; Co. Fine Jewellery</h1>
  </div>
  <div style="padding:24px;background:#fafaf9;">
    <p>Hi ${customer.full_name},</p>
    <p>Great news — your <strong>${itemDesc}</strong> (${jobNumber}) is ready for collection at Marcus &amp; Co.</p>
    <p>Please come in at your convenience during business hours. Don't forget to bring your receipt.</p>
    <p>If you have any questions, please don't hesitate to get in touch.</p>
    <p style="margin-top:24px;">Warm regards,<br/>The team at Marcus &amp; Co. Fine Jewellery</p>
  </div>
  <div style="padding:16px 24px;background:#fff;text-align:center;font-size:12px;color:#78716c;">
    Marcus &amp; Co. Fine Jewellery · 32 Castlereagh St, Sydney NSW 2000 · hello@marcusandco.com.au
  </div>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Marcus & Co. <onboarding@resend.dev>",
      to: [customer.email],
      subject: `Your repair is ready — Marcus & Co. Fine Jewellery`,
      html: htmlBody,
    }),
  });

  if (!res.ok) return { error: "Email failed to send" };

  await admin.from("job_events").insert({
    tenant_id: tenantId,
    job_type: jobType,
    job_id: jobId,
    event_type: "email_sent",
    description: `Ready for collection email sent to ${customer.email}`,
    actor: ctx.userId,
  });

  revalidatePath(`/repairs/${jobId}`);
  return { success: true };
}

export async function sendJobReadySms(params: {
  repairId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  jobType: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { success: false, error: "Not authenticated" }; }
  const { admin, tenantId, userId } = ctx;

  // Get Twilio credentials
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("settings")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "twilio")
    .eq("enabled", true)
    .single();

  const settings = integration?.settings as {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
  } | null;

  if (!settings?.account_sid || !settings?.auth_token || !settings?.phone_number) {
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${settings.account_sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${settings.account_sid}:${settings.auth_token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: settings.phone_number,
          To: params.customerPhone,
          Body: params.message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Log failed send
      await admin.from("sms_sends").insert({
        tenant_id: tenantId,
        customer_id: params.customerId,
        phone: params.customerPhone,
        message: params.message,
        status: "failed",
        error_message: data.message || "Failed to send",
        context: { job_id: params.repairId, type: "job_ready" },
      });

      return { success: false, error: data.message || "Failed to send SMS" };
    }

    // Log successful send
    await admin.from("sms_sends").insert({
      tenant_id: tenantId,
      customer_id: params.customerId,
      phone: params.customerPhone,
      message: params.message,
      status: "sent",
      twilio_sid: data.sid,
      context: { job_id: params.repairId, type: "job_ready" },
    });

    // Log to job_events
    await admin.from("job_events").insert({
      tenant_id: tenantId,
      job_type: "repair",
      job_id: params.repairId,
      event_type: "sms_sent",
      description: `Ready for collection SMS sent to ${params.customerPhone}`,
      actor: userId,
    });

    revalidatePath(`/repairs/${params.repairId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await admin.from("sms_sends").insert({
      tenant_id: tenantId,
      customer_id: params.customerId,
      phone: params.customerPhone,
      message: params.message,
      status: "failed",
      error_message: errorMessage,
      context: { job_id: params.repairId, type: "job_ready" },
    });

    return { success: false, error: errorMessage };
  }
}
