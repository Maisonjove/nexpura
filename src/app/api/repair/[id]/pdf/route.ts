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

  const { data: repair, error } = await supabase
    .from("repairs")
    .select("*, customers(full_name, email, phone)")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !repair) return new NextResponse("Not found", { status: 404 });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, phone, email")
    .eq("id", userData.tenant_id)
    .single();

  const customer = Array.isArray(repair.customers) ? repair.customers[0] : repair.customers;

  const ticketData = {
    ticketNumber: repair.ticket_number ?? repair.id,
    tenantName: tenant?.name ?? "Jewellery Studio",
    tenantPhone: tenant?.phone,
    tenantEmail: tenant?.email,
    customerName: customer?.full_name ?? repair.customer_name,
    customerPhone: customer?.phone,
    customerEmail: customer?.email ?? repair.customer_email,
    itemType: repair.item_type,
    itemDescription: repair.item_description,
    metalType: repair.metal_type,
    brand: repair.brand,
    conditionNotes: repair.condition_notes,
    repairType: repair.repair_type,
    workDescription: repair.work_description,
    priority: repair.priority,
    status: repair.status,
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
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
