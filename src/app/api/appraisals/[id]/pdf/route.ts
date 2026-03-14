import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { AppraisalPDF } from "@/lib/pdf/AppraisalPDF";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: appraisal } = await admin
      .from("appraisals")
      .select("*")
      .eq("id", id)
      .single();

    if (!appraisal) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
