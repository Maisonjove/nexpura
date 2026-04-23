import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import BespokeSheetPDF from "@/lib/pdf/BespokeSheetPDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertUserCanAccessLocation, LocationAccessDeniedError } from "@/lib/auth/assert-location";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = _request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "pdf");
  if (!success) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const { id } = await params;

  // Auth check via regular client (needs cookies)
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

  // Use admin client for data fetch to bypass RLS (same pattern as detail pages)
  const adminClient = createAdminClient();

  const { data: job, error } = await adminClient
    .from("bespoke_jobs")
    .select(
      `id, job_number, location_id, customer_id, customer_name, customer_email,
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

  if (error || !job) return new NextResponse("Not found", { status: 404 });

  // W2-005: gate PDF on location scope — cross-location restricted
  // staff must not be able to pull another location's bespoke job PDF.
  try {
    await assertUserCanAccessLocation(user.id, userData.tenant_id, job.location_id);
  } catch (e) {
    if (e instanceof LocationAccessDeniedError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw e;
  }

  const { data: tenant } = await adminClient
    .from("tenants")
    .select("name, business_name, abn, phone, email, address_line1, suburb, state, postcode")
    .eq("id", userData.tenant_id)
    .single();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

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

  const filename = `bespoke-${jobData.jobNumber.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
