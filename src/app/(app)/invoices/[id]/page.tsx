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

  const [{ data: invoice }, { data: lineItems }, { data: payments }, { data: tenant }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          `id, invoice_number, status, invoice_date, due_date, paid_at,
           subtotal, tax_amount, discount_amount, total, amount_paid, amount_due,
           tax_name, tax_rate, tax_inclusive, notes, footer_text, reference_type,
           created_at,
           customers(id, full_name, email, phone, mobile, address_line1, suburb, state, postcode)`
        )
        .eq("id", id)
        .eq("tenant_id", tenantId ?? "")
        .is("deleted_at", null)
        .single(),
      supabase
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, discount_pct, total, sort_order")
        .eq("invoice_id", id)
        .order("sort_order"),
      supabase
        .from("payments")
        .select("id, amount, payment_method, payment_date, reference, notes, created_at")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: true }),
      supabase
        .from("tenants")
        .select(
          "name, business_name, abn, logo_url, bank_name, bank_bsb, bank_account, address_line1, suburb, state, postcode, phone, email"
        )
        .eq("id", tenantId ?? "")
        .single(),
    ]);

  if (!invoice) notFound();

  // Supabase returns joined relations as arrays; normalize
  const normalizedInvoice = {
    ...invoice,
    customers: Array.isArray(invoice.customers)
      ? (invoice.customers[0] ?? null)
      : invoice.customers,
  };

  return (
    <InvoiceDetailClient
      invoice={normalizedInvoice}
      lineItems={lineItems || []}
      payments={payments || []}
      tenant={tenant}
    />
  );
}
