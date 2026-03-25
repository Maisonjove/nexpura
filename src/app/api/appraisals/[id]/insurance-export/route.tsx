/**
 * GET /api/appraisals/[id]/insurance-export
 *
 * Generates a formatted Insurance Valuation Certificate PDF.
 * Uses @react-pdf/renderer with the InsurancePDF component.
 * Requires the insurance integration to be enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, getIntegration } from "@/lib/integrations";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { InsurancePDF } from "@/lib/pdf/InsurancePDF";
import logger from "@/lib/logger";

export async function GET(
  req: NextRequest,
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    // Optionally pull appraiser details from insurance integration config
    const insuranceIntegration = await getIntegration(tenantId, "insurance");
    const insuranceCfg = (insuranceIntegration?.config ?? {}) as Record<string, unknown>;

    // Use integration config to fill in any blanks from the appraisal record
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

    const stream = await renderToStream(
      <InsurancePDF appraisal={enrichedAppraisal} tenant={tenant} />
    );

    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="insurance-valuation-${id}.pdf"`,
      },
    });
  } catch (err) {
    logger.error("[insurance-export]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
