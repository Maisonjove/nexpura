import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoicePDF, type InvoiceLayout } from "@/lib/pdf/InvoicePDF";
import { ThermalInvoicePDF } from "@/lib/pdf/ThermalInvoicePDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format"); // 'thermal' or null

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Use admin client to avoid RLS recursion on users table
  const adminClient = createAdminClient();

  // Get user's tenant
  const { data: userData } = await adminClient
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Fetch invoice — validate ownership via tenant_id filter
  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select(
      `id, invoice_number, status, invoice_date, due_date,
       subtotal, tax_amount, discount_amount, total, paid_at, amount_paid,
       tax_name, tax_rate, tax_inclusive, notes, footer_text,
       customers(full_name, email, phone, address)`
    )
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (invoiceError || !invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  // Fetch line items
  const { data: lineItemsRaw } = await adminClient
    .from("invoice_line_items")
    .select("description, quantity, unit_price, discount_pct, line_total")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  // Fetch actual payments
  const { data: paymentsRaw } = await adminClient
    .from("payments")
    .select("amount")
    .eq("invoice_id", id);

  // Compute amount_paid from actual payments
  const paymentsTotal = (paymentsRaw ?? []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const amount_paid = paymentsTotal > 0 ? paymentsTotal : (invoice.amount_paid ?? 0);
  const amount_due = Math.max(0, (invoice.total ?? 0) - amount_paid);

  // Fetch tenant info
  const { data: tenant } = await adminClient
    .from("tenants")
    .select(
      "name, business_name, abn, logo_url, phone, email, address_line1, suburb, state, postcode, bank_name, bank_bsb, bank_account, invoice_footer, invoice_accent_color, tax_name, tax_rate, tax_inclusive"
    )
    .eq("id", userData.tenant_id)
    .single();

  // Fetch printer settings for thermal format
  const { data: printerConfig } = await adminClient
    .from("printer_configs")
    .select("paper_width")
    .eq("tenant_id", userData.tenant_id)
    .eq("printer_type", "receipt")
    .single();

  const paperWidth = (printerConfig?.paper_width as string) || "80mm";

  // Build typed invoice data
  const customerRaw = Array.isArray(invoice.customers)
    ? (invoice.customers[0] ?? null)
    : invoice.customers;

  const invoiceData = {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date ?? null,
    paid_at: invoice.paid_at ?? null,
    subtotal: invoice.subtotal ?? 0,
    tax_amount: invoice.tax_amount ?? 0,
    discount_amount: invoice.discount_amount ?? 0,
    total: invoice.total ?? 0,
    amount_paid,
    amount_due,
    tax_name: invoice.tax_name ?? "GST",
    tax_rate: invoice.tax_rate ?? 0.1,
    tax_inclusive: invoice.tax_inclusive ?? true,
    notes: invoice.notes ?? null,
    footer_text: invoice.footer_text ?? null,
    layout: 'classic',
    customers: customerRaw
      ? {
          full_name: customerRaw.full_name ?? null,
          email: customerRaw.email ?? null,
          phone: customerRaw.phone ?? null,
          address: customerRaw.address ?? null,
        }
      : null,
  };

  const lineItems = (lineItemsRaw ?? []).map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount_pct: Number(item.discount_pct ?? 0),
    // line_total is the DB column; alias to total for the PDF component
    total: Number((item as Record<string, unknown>).line_total ?? (item as Record<string, unknown>).total ?? 0),
  }));

  const tenantData = tenant
    ? {
        name: tenant.name ?? "",
        business_name: tenant.business_name ?? null,
        abn: tenant.abn ?? null,
        logo_url: tenant.logo_url ?? null,
        phone: tenant.phone ?? null,
        email: tenant.email ?? null,
        address_line1: tenant.address_line1 ?? null,
        suburb: tenant.suburb ?? null,
        state: tenant.state ?? null,
        postcode: tenant.postcode ?? null,
        bank_name: tenant.bank_name ?? null,
        bank_bsb: tenant.bank_bsb ?? null,
        bank_account: tenant.bank_account ?? null,
        invoice_footer: tenant.invoice_footer ?? null,
      invoice_accent_color: tenant.invoice_accent_color ?? null,
      }
    : null;

  // Render PDF
  const Component = format === "thermal" ? ThermalInvoicePDF : InvoicePDF;
  const props = format === "thermal" 
    ? { invoice: invoiceData, lineItems, tenant: tenantData, paperWidth }
    : { invoice: invoiceData, lineItems, tenant: tenantData, layout: (invoiceData.layout as InvoiceLayout) || "classic" };
  const element = React.createElement(Component, {
    ...props,
    tenant: tenantData,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);
  } catch (err) {
    console.error('[invoice/pdf] renderToBuffer failed:', err);
    return new NextResponse("Failed to generate PDF", { status: 500 });
  }

  const suffix = format === "thermal" ? "-thermal" : "";
  const filename = `${invoice.invoice_number.replace(/\//g, "-")}${suffix}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
