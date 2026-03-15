import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import RepairTicketPDF from "@/lib/pdf/RepairTicketPDF";
import { Resend } from "resend";
import React, { type JSXElementConstructor, type ReactElement } from "react";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: repair, error } = await adminClient
    .from("repairs")
    .select(
      `id, repair_number, customer_id, customer_name, customer_email,
       item_type, item_description, metal_type, brand, condition_notes,
       repair_type, work_description, work_required, technician,
       priority, stage, quoted_price, final_price, deposit_amount, deposit_paid,
       due_date, completed_at, internal_notes, client_notes, notes, created_at,
       customers(full_name, email, phone, address)`
    )
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !repair)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customerRaw = Array.isArray(repair.customers) ? repair.customers[0] : repair.customers;
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
    customerName: customerRaw?.full_name ?? repair.customer_name,
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
    technician: repair.technician,
    clientNotes: repair.client_notes,
    createdAt: repair.created_at,
  };

  const element = React.createElement(RepairTicketPDF, { ticket: ticketData });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const businessName = tenant?.business_name || tenant?.name || "Jewellery Studio";
  const ticketNumber = ticketData.ticketNumber;
  const filename = `receipt-${String(ticketNumber).replace(/\//g, "-")}.pdf`;

  const storePhone = tenant?.phone ? ` | ${tenant.phone}` : "";
  const storeAddr = tenantAddress ? ` | ${tenantAddress}` : "";

  const resend = new Resend(process.env.RESEND_API_KEY);
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
      <td><p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${businessName}</p>${tenant?.abn ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.5);">ABN: ${tenant.abn}</p>` : ""}</td>
      <td align="right"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;">REPAIR RECEIPT</p><p style="margin:3px 0 0;font-size:18px;font-weight:700;color:#8B7355;">${ticketNumber}</p></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:36px;">
    <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;font-weight:600;">Hi ${ticketData.customerName || "Valued Customer"},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">Thank you for bringing in your item. Your repair receipt is attached as a PDF. Here's a summary:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;border-radius:8px;margin-bottom:28px;border:1px solid #E5E2DE;"><tr><td style="padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Ticket #</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${ticketNumber}</p></td>
        <td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Item</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${ticketData.itemDescription || ticketData.itemType || "—"}</p></td></tr>
        ${ticketData.quotedPrice != null ? `<tr><td style="width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Quoted Price</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">$${Number(ticketData.quotedPrice).toFixed(2)}</p></td>` : "<tr><td>"}
        <td style="width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Due Date</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${ticketData.dueDate ? new Date(ticketData.dueDate).toLocaleDateString("en-AU", {day:"numeric",month:"short",year:"numeric"}) : "To be advised"}</p></td></tr>
      </table>
    </td></tr></table>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">We'll contact you when your item is ready for collection. If you have any questions, please reply to this email${tenant?.phone ? ` or call us at ${tenant.phone}` : ""}.</p>
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

  return NextResponse.json({ success: true });
}
