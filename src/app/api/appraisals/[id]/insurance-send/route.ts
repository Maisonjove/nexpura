/**
 * POST /api/appraisals/[id]/insurance-send
 *
 * Emails an insurance valuation PDF to the customer via Resend.
 * Generates the PDF on the fly and attaches it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { getResend } from "@/lib/email/resend";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InsurancePDF } from "@/lib/pdf/InsurancePDF";
import logger from "@/lib/logger";
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

  try {
    const { id } = await params;
    const { tenantId } = await getAuthContext();

    const admin = createAdminClient();

    const { data: appraisal } = await admin
      .from("appraisals")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (!appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    if (!appraisal.customer_email) {
      return NextResponse.json(
        { error: "Customer has no email address on this appraisal" },
        { status: 400 }
      );
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    const insuranceIntegration = await getIntegration(tenantId, "insurance");
    const insuranceCfg = (insuranceIntegration?.config ?? {}) as Record<string, unknown>;

    const appraiserName =
      (appraisal.appraiser_name as string | null) ||
      (insuranceCfg.appraiser_name as string | null) ||
      null;
    const appraiserLicence =
      (appraisal.appraiser_licence as string | null) ||
      (insuranceCfg.appraiser_license as string | null) ||
      null;

    const enrichedAppraisal = {
      ...appraisal,
      appraiser_name: appraiserName,
      appraiser_licence: appraiserLicence,
    };

    const businessName =
      (tenant as any)?.business_name || (tenant as any)?.name || "Your Jeweller";

    // Generate PDF as buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as any)(
      React.createElement(InsurancePDF, { appraisal: enrichedAppraisal, tenant })
    );

    const tenantAddress = [
      (tenant as any)?.address_line1,
      (tenant as any)?.suburb,
      (tenant as any)?.state,
      (tenant as any)?.postcode,
    ].filter(Boolean).join(", ");

    const customerName = (appraisal.customer_name as string | null) || "Valued Customer";
    const itemName = (appraisal.item_name as string | null) || "jewellery item";
    const appraisalNumber = (appraisal.appraisal_number as string) || "";
    const tenantPhone = (tenant as any)?.phone || null;
    const tenantEmail = (tenant as any)?.email || null;
    const tenantAbn = (tenant as any)?.abn || null;
    const storeFooter = [businessName, tenantPhone, tenantAddress].filter(Boolean).join(" | ");

    const { data, error } = await getResend().emails.send({
      from: `${businessName} <receipts@nexpura.com>`,
      to: [appraisal.customer_email as string],
      replyTo: tenantEmail ? [tenantEmail] : undefined,
      subject: `Insurance Valuation Certificate — ${appraisalNumber}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F8F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1A1A1A;border-radius:12px 12px 0 0;padding:28px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${businessName}</p>${tenantAbn ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.5);">ABN: ${tenantAbn}</p>` : ""}</td>
      <td align="right"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;">VALUATION CERTIFICATE</p><p style="margin:3px 0 0;font-size:18px;font-weight:700;color:#8B7355;">${appraisalNumber}</p></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:36px;">
    <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;font-weight:600;">Dear ${customerName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">Please find your Insurance Valuation Certificate attached for the following item. This certificate is for insurance purposes and confirms the replacement value of your piece.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;border-radius:8px;margin-bottom:28px;border:1px solid #E5E2DE;"><tr><td style="padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Certificate No.</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${appraisalNumber}</p></td>
        <td style="padding-bottom:12px;width:50%;"><p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Item</p><p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${itemName}</p></td></tr>
      </table>
    </td></tr></table>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">Please retain this certificate for your insurance records. If you have any questions, please reply to this email${tenantPhone ? ` or call us at ${tenantPhone}` : ""}.</p>
  </td></tr>
  <tr><td style="background:#F8F5F0;border-radius:0 0 12px 12px;padding:16px 36px;border-top:1px solid #E5E2DE;">
    <p style="margin:0;font-size:11px;color:#aaa;text-align:center;">Sent by <strong>${storeFooter}</strong> using <a href="https://nexpura.com" style="color:#8B7355;text-decoration:none;">Nexpura</a></p>
  </td></tr>
</table></td></tr></table></body></html>`,
      attachments: [
        {
          filename: `insurance-valuation-${appraisal.appraisal_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, email_id: data?.id });
  } catch (err) {
    logger.error("[insurance-send]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
