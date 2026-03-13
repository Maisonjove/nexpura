import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import InvoiceDetailClient from "./InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const [{ data: invoice }, { data: lineItems }, { data: tenant }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          `id, invoice_number, status, invoice_date, due_date, paid_at,
           subtotal, tax_amount, discount_amount, total,
           tax_name, tax_rate, tax_inclusive, notes, footer_text, reference_type,
           created_at,
           customers(id, full_name, email, phone, address)`
        )
        .eq("id", id)
        .eq("tenant_id", tenantId ?? "")
        .single(),
      supabase
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, discount_pct, total, sort_order")
        .eq("invoice_id", id)
        .order("sort_order"),
      supabase
        .from("tenants")
        .select("name, slug, logo_url, brand_color")
        .eq("id", tenantId ?? "")
        .single(),
    ]);

  if (!invoice) notFound();

  // Normalize customer join (Supabase may return array)
  const rawCustomer = Array.isArray(invoice.customers)
    ? (invoice.customers[0] ?? null)
    : invoice.customers;

  // Normalize customer to expected shape (fill in missing DB columns with null)
  const normalizedCustomer = rawCustomer ? {
    id: rawCustomer.id,
    full_name: rawCustomer.full_name,
    email: rawCustomer.email,
    phone: rawCustomer.phone,
    mobile: null,
    address_line1: rawCustomer.address ?? null,
    suburb: null,
    state: null,
    postcode: null,
  } : null;

  // Compute amount_paid / amount_due from status + total
  const total = invoice.total ?? 0;
  const amountPaid = invoice.status === "paid" ? total : 0;
  const amountDue = invoice.status === "paid" ? 0 : total;

  const normalizedInvoice = {
    ...invoice,
    customers: normalizedCustomer,
    amount_paid: amountPaid,
    amount_due: amountDue,
  };

  // Normalize tenant to expected shape
  const normalizedTenant = tenant ? {
    name: tenant.name,
    business_name: tenant.name,
    abn: null,
    logo_url: tenant.logo_url,
    bank_name: null,
    bank_bsb: null,
    bank_account: null,
    address_line1: null,
    suburb: null,
    state: null,
    postcode: null,
    phone: null,
    email: null,
  } : null;

  return (
    <InvoiceDetailClient
      invoice={normalizedInvoice}
      lineItems={lineItems || []}
      payments={[]}
      tenant={normalizedTenant}
    />
  );
}
