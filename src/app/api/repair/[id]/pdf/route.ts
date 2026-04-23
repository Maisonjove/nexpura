import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import RepairTicketPDF from "@/lib/pdf/RepairTicketPDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertUserCanAccessLocation, LocationAccessDeniedError } from "@/lib/auth/assert-location";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check via regular client (needs cookies)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Rate limit keyed by user id (not IP) — IP-based shares an "anonymous"
  // bucket when x-forwarded-for is missing, which bites real users.
  const { success } = await checkRateLimit(user.id, "pdf");
  if (!success) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return new NextResponse("Forbidden", { status: 403 });

  // Use admin client for data fetch to bypass RLS (same pattern as detail pages)
  const adminClient = createAdminClient();

  const { data: repair, error } = await adminClient
    .from("repairs")
    .select(
      `id, repair_number, location_id, customer_id, customer_name, customer_email,
       item_type, item_description, metal_type, brand, condition_notes,
       repair_type, work_description, work_required, technician,
       priority, stage, quoted_price, final_price, deposit_amount, deposit_paid,
       due_date, completed_at, internal_notes, client_notes, notes, created_at,
       customers(full_name, email, phone, address)`
    )
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !repair) return new NextResponse("Not found", { status: 404 });

  // W2-005: multi-location tenants — a location-restricted staff user
  // must not be able to fetch a PDF for a repair at a location they
  // aren't assigned to. Owners/managers (null allowed_location_ids)
  // pass through. Legacy rows (location_id null) pass through.
  try {
    await assertUserCanAccessLocation(user.id, userData.tenant_id, repair.location_id);
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

  const customerRaw = Array.isArray(repair.customers) ? repair.customers[0] : repair.customers;

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

   
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const filename = `repair-${ticketData.ticketNumber.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
