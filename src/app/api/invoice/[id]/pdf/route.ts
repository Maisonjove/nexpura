import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf/InvoicePDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Get user's tenant
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Fetch invoice — validate ownership
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      `id, invoice_number, status, invoice_date, due_date,
       subtotal, tax_amount, discount_amount, total, amount_paid, amount_due,
       tax_name, tax_rate, tax_inclusive, notes, footer_text,
       customers(full_name, email, phone, mobile, address_line1, suburb, state, postcode)`
    )
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (invoiceError || !invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  // Fetch line items
  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("id, description, quantity, unit_price, discount_pct, total, sort_order")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  // Fetch tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "name, business_name, abn, logo_url, bank_name, bank_bsb, bank_account, address_line1, suburb, state, postcode, phone, email"
    )
    .eq("id", userData.tenant_id)
    .single();

  // Build typed data
  const invoiceData = {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    subtotal: invoice.subtotal,
    tax_amount: invoice.tax_amount,
    discount_amount: invoice.discount_amount,
    total: invoice.total,
    amount_paid: invoice.amount_paid,
    amount_due: invoice.amount_due,
    tax_name: invoice.tax_name,
    tax_rate: invoice.tax_rate,
    tax_inclusive: invoice.tax_inclusive,
    notes: invoice.notes,
    footer_text: invoice.footer_text,
    customers: Array.isArray(invoice.customers)
      ? (invoice.customers[0] ?? null)
      : invoice.customers,
  };

  const lineItemsData = (lineItems ?? []).map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct ?? 0,
    total: item.total,
  }));

  // Render PDF
  const element = React.createElement(InvoicePDF, {
    invoice: invoiceData,
    lineItems: lineItemsData,
    tenant: tenant ?? null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const filename = `${invoice.invoice_number.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
