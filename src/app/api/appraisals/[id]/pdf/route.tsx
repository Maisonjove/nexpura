import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { AppraisalPDF } from "@/lib/pdf/AppraisalPDF";
import logger from "@/lib/logger";

/**
 * Launch-QA W7-CRIT-02 + W4-APR2: this route previously had ZERO auth and
 * derived the tenant from the appraisal record. Any unauthenticated caller
 * who guessed an appraisal UUID could download another tenant's appraisal
 * PDF (containing customer name, item value, photos, insurance rider).
 *
 * The fix:
 *   1. Require a valid session (no more public access).
 *   2. Load the appraisal by id using the service-role client.
 *   3. Assert the caller's session-derived tenant matches the appraisal's
 *      tenant before rendering. Cross-tenant requests return 403.
 *
 * If a public/token-based flow is required in the future, add a signed
 * short-lived URL path here — do NOT fall back to unauthenticated access.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require a logged-in user.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the caller's tenant from the session (not from any request
    // input). This is the only tenant the caller is allowed to render PDFs
    // for.
    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const callerTenantId = profile?.tenant_id;
    if (!callerTenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const admin = createAdminClient();

    const { data: appraisal } = await admin
      .from("appraisals")
      .select("*")
      .eq("id", id)
      .single();

    if (!appraisal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Cross-tenant access is a 403, not a 404 — we know the record exists;
    // we're refusing because it does not belong to the caller's tenant.
    if (appraisal.tenant_id !== callerTenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("*")
      .eq("id", appraisal.tenant_id)
      .single();

    const stream = await renderToStream(
      <AppraisalPDF appraisal={appraisal} tenant={tenant} />
    );

    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="appraisal-${id}.pdf"`,
      },
    });
  } catch (err) {
    logger.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
