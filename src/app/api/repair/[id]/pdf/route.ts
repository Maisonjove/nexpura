import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import RepairTicketPDF from "@/lib/pdf/RepairTicketPDF";
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

  // Select only real DB columns (repair_number and stage are correct column names)
  const { data: repair, error } = await supabase
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

  if (error || !repair) return new NextResponse("Not found", { status: 404 });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, business_name, abn, phone, email, address_line1, suburb, state, postcode")
    .eq("id", userData.tenant_id)
    .single();

  const customerRaw = Array.isArray(repair.customers) ? repair.customers[0] : repair.customers;

  const ticketData = {
    ticketNumber: repair.repair_number ?? repair.id,
    tenantName: tenant?.business_name || tenant?.name || "Jewellery Studio",
    tenantPhone: tenant?.phone,
    tenantEmail: tenant?.email,
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
    dueDate: repair.due_date,
    technician: repair.technician,
    clientNotes: repair.client_notes,
    createdAt: repair.created_at,
  };

  const element = React.createElement(RepairTicketPDF, { ticket: ticketData });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
