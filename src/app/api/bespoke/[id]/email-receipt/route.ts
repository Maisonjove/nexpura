import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import BespokeSheetPDF from "@/lib/pdf/BespokeSheetPDF";
import { resend } from "@/lib/email/resend";
import React, { type JSXElementConstructor, type ReactElement } from "react";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = _req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  const { data: job, error } = await adminClient
    .from("bespoke_jobs")
    .select(
      `id, job_number, customer_id, customer_name, customer_email,
       title, description, order_type, jewellery_type, stage, priority,
       metal_type, metal_colour, metal_purity, metal_weight_grams,
       stone_type, stone_colour, stone_carat,
       design_notes, client_notes, internal_notes,
       estimated_cost, final_cost, deposit_amount, deposit_received,
       due_date, completed_at, notes, created_at,
       customers(full_name, email, phone, address)`
    )
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !job)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const recipientEmail = customer?.email ?? job.customer_email;

  if (!recipientEmail)
    return NextResponse.json({ error: "Customer has no email address" }, { status: 400 });

  const { data: tenant } = await adminClient
    .from("tenants")
    .select("name, business_name, abn, phone, email, address_line1, suburb, state, postcode")
    .eq("id", userData.tenant_id)
    .single();

  const tenantAddress = [tenant?.address_line1, tenant?.suburb, tenant?.state, tenant?.postcode].filter(Boolean).join(", ");

  const jobData = {
    jobNumber: job.job_number ?? job.id,
    title: job.title,
    description: job.description,
    tenantName: tenant?.business_name || tenant?.name || "Your Store Name",
    tenantPhone: tenant?.phone ?? undefined,
    tenantEmail: tenant?.email ?? undefined,
    tenantAddress: tenantAddress || undefined,
    tenantAbn: tenant?.abn ?? undefined,
    customerName: customer?.full_name ?? job.customer_name,
    customerPhone: customer?.phone,
    customerEmail: customer?.email ?? job.customer_email,
    stage: job.stage,
    jewelleryType: job.jewellery_type,
    orderType: job.order_type,
    metalType: job.metal_type,
    metalColour: job.metal_colour,
    metalPurity: job.metal_purity,
    metalWeightGrams: job.metal_weight_grams,
    stoneType: job.stone_type,
    stoneColour: job.stone_colour,
    stoneCarat: job.stone_carat,
    designNotes: job.design_notes,
    estimatedCost: job.estimated_cost,
    depositAmount: job.deposit_amount,
    depositReceived: job.deposit_received,
    dueDate: job.due_date,
    clientNotes: job.client_notes,
    createdAt: job.created_at,
  };

  const element = React.createElement(BespokeSheetPDF, { job: jobData });
   
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const businessName = tenant?.business_name || tenant?.name || "Jewellery Studio";
  const jobNumber = jobData.jobNumber;
  const filename = `receipt-${String(jobNumber).replace(/\//g, "-")}.pdf`;

  const storePhone = tenant?.phone ? ` | ${tenant.phone}` : "";
  const storeAddr = tenantAddress ? ` | ${tenantAddress}` : "";
  const customerDisplayName = jobData.customerName || "Valued Customer";

  const { error: sendError } = await resend.emails.send({
    from: `${businessName} <receipts@nexpura.com>`,
    to: [recipientEmail],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject: `Your Bespoke Job Receipt — ${jobNumber}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F8F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1A1A1A;border-radius:12px 12px 0 0;padding:28px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${businessName}</p>${tenant?.abn ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.5);">ABN: ${tenant.abn}</p>` : ""}</td>
      <td align="right"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;">BESPOKE JOB RECEIPT</p><p style="margin:3px 0 0;font-size:18px;font-weight:700;color:#8B7355;">${jobNumber}</p></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:36px;">
    <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;font-weight:600;">Hi ${customerDisplayName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">Thank you for placing your bespoke order with us. Your job receipt is attached. Here's a summary:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;border-radius:8px;margin-bottom:28px;border:1px solid #E5E2DE;"><tr><td style="padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Job #</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${jobNumber}</p></td>
          <td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Title</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${jobData.title || "—"}</p></td>
        </tr>
        ${jobData.estimatedCost != null ? `<tr><td style="width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Estimated Cost</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">$${Number(jobData.estimatedCost).toFixed(2)}</p></td>` : "<tr><td>"}
        <td style="width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Due Date</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${jobData.dueDate ? new Date(jobData.dueDate).toLocaleDateString("en-AU", {day:"numeric",month:"short",year:"numeric"}) : "To be advised"}</p></td></tr>
      </table>
    </td></tr></table>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">Our team will be in touch with progress updates. If you have any questions, please reply to this email${tenant?.phone ? ` or call us at ${tenant.phone}` : ""}.</p>
  </td></tr>
  <tr><td style="background:#F8F5F0;border-radius:0 0 12px 12px;padding:16px 36px;border-top:1px solid #E5E2DE;">
    <p style="margin:0;font-size:11px;color:#aaa;text-align:center;">Sent by <strong>${businessName}</strong>${storePhone}${storeAddr} using <a href="https://nexpura.com" style="color:#8B7355;text-decoration:none;">Nexpura</a></p>
  </td></tr>
</table></td></tr></table></body></html>`,
    attachments: [
      {
        filename,
        content: Buffer.from(buffer),
      },
    ],
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  // Log communication to customer_communications
  if (job.customer_id) {
    await adminClient.from("customer_communications").insert({
      tenant_id: userData.tenant_id,
      customer_id: job.customer_id,
      type: "email_receipt",
      subject: `Bespoke Job Receipt — ${job.job_number ?? job.id}`,
      sent_at: new Date().toISOString(),
      sent_by: user.id,
    });
  }

  return NextResponse.json({ success: true });
}
