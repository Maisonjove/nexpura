/**
 * POST /api/appraisals/[id]/insurance-send
 *
 * Emails an insurance valuation PDF to the customer via Resend.
 * Generates the PDF on the fly and attaches it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { resend } from "@/lib/email/resend";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InsurancePDF } from "@/lib/pdf/InsurancePDF";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data, error } = await resend.emails.send({
      from: `${businessName} <onboarding@resend.dev>`,
      to: [appraisal.customer_email as string],
      subject: `Your Insurance Valuation Certificate — ${appraisal.appraisal_number}`,
      html: `
        <p>Dear ${appraisal.customer_name || "Valued Customer"},</p>
        <p>Please find your Insurance Valuation Certificate attached for the item: <strong>${appraisal.item_name}</strong>.</p>
        <p>Appraisal number: <strong>${appraisal.appraisal_number}</strong></p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <br/>
        <p>${businessName}</p>
      `,
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
    console.error("[insurance-send]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
