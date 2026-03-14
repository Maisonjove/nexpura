import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import BespokeSheetPDF from "@/lib/pdf/BespokeSheetPDF";
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

  const jobData = {
    jobNumber: job.job_number ?? job.id,
    title: job.title,
    description: job.description,
    tenantName: tenant?.business_name || tenant?.name || "Jewellery Studio",
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

  const businessName = tenant?.business_name || tenant?.name || "Jewellery Studio";
  const jobNumber = jobData.jobNumber;
  const filename = `receipt-${String(jobNumber).replace(/\//g, "-")}.pdf`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: `${businessName} <onboarding@resend.dev>`,
    to: [recipientEmail],
    replyTo: tenant?.email ? [tenant.email] : undefined,
    subject: `Your Bespoke Job Receipt — ${jobNumber}`,
    text: `Please find attached your receipt for bespoke job ${jobNumber}.\n\nThank you for choosing ${businessName}.`,
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
