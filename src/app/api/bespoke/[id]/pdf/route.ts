import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import BespokeSheetPDF from "@/lib/pdf/BespokeSheetPDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return new NextResponse("Forbidden", { status: 403 });

  const { data: job, error } = await supabase
    .from("bespoke_jobs")
    .select("*, customers(full_name, email, phone)")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !job) return new NextResponse("Not found", { status: 404 });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, phone, email")
    .eq("id", userData.tenant_id)
    .single();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  const jobData = {
    jobNumber: job.job_number ?? job.id,
    title: job.title,
    description: job.description,
    tenantName: tenant?.name ?? "Jewellery Studio",
    tenantPhone: tenant?.phone,
    tenantEmail: tenant?.email,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const filename = `bespoke-${jobData.jobNumber.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
