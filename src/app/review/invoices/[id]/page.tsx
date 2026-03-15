import { createAdminClient } from "@/lib/supabase/admin";
import InvoiceDetailClient from "@/app/(app)/invoices/[id]/InvoiceDetailClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEFAULT_ID = "2c6672d1-884e-4d96-accf-b8a88ab2e27e";

export default async function ReviewInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = rawId || DEFAULT_ID;
  const admin = createAdminClient();

  const [{ data: invoice }, { data: lineItems }, { data: tenant }, { data: paymentsRaw }] =
    await Promise.all([
      admin
        .from("invoices")
        .select(
          `id, invoice_number, status, invoice_date, due_date, paid_at,
           subtotal, tax_amount, discount_amount, total, amount_paid,
           tax_name, tax_rate, tax_inclusive, notes, footer_text, reference_type,
           created_at,
           customers(id, full_name, email, phone, mobile, address_line1, suburb, state, postcode)`
        )
        .eq("id", id)
        .eq("tenant_id", TENANT_ID)
        .single(),
      admin
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, discount_pct, total, sort_order")
        .eq("invoice_id", id)
        .order("sort_order"),
      admin
        .from("tenants")
        .select("name, slug, logo_url, brand_color, business_name, abn, phone, email, address_line1, suburb, state, postcode, bank_name, bank_bsb, bank_account, invoice_footer")
        .eq("id", TENANT_ID)
        .single(),
      admin
        .from("payments")
        .select("id, amount, payment_method, payment_date, reference, notes, created_at")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: true }),
    ]);

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Invoice Not Found</h1>
        <p className="text-stone-500">This invoice doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const rawCustomer = Array.isArray(invoice.customers)
    ? (invoice.customers[0] ?? null)
    : invoice.customers;

  const normalizedCustomer = rawCustomer ? {
    id: rawCustomer.id,
    full_name: rawCustomer.full_name,
    email: rawCustomer.email,
    phone: rawCustomer.phone,
    mobile: (rawCustomer as { mobile?: string | null }).mobile ?? null,
    address_line1: (rawCustomer as { address_line1?: string | null }).address_line1 ?? null,
    suburb: (rawCustomer as { suburb?: string | null }).suburb ?? null,
    state: (rawCustomer as { state?: string | null }).state ?? null,
    postcode: (rawCustomer as { postcode?: string | null }).postcode ?? null,
  } : null;

  const payments = paymentsRaw ?? [];
  const dynamicAmountPaid = payments.length > 0
    ? payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    : (invoice.amount_paid || 0);
  const amountDue = Math.max(0, (invoice.total ?? 0) - dynamicAmountPaid);

  const normalizedInvoice = {
    ...invoice,
    customers: normalizedCustomer,
    amount_paid: dynamicAmountPaid,
    amount_due: amountDue,
  };

  const normalizedTenant = tenant ? {
    name: tenant.name,
    business_name: tenant.business_name ?? tenant.name,
    abn: (tenant as { abn?: string | null }).abn ?? null,
    logo_url: tenant.logo_url,
    bank_name: (tenant as { bank_name?: string | null }).bank_name ?? null,
    bank_bsb: (tenant as { bank_bsb?: string | null }).bank_bsb ?? null,
    bank_account: (tenant as { bank_account?: string | null }).bank_account ?? null,
    address_line1: (tenant as { address_line1?: string | null }).address_line1 ?? null,
    suburb: (tenant as { suburb?: string | null }).suburb ?? null,
    state: (tenant as { state?: string | null }).state ?? null,
    postcode: (tenant as { postcode?: string | null }).postcode ?? null,
    phone: (tenant as { phone?: string | null }).phone ?? null,
    email: (tenant as { email?: string | null }).email ?? null,
  } : null;

  return (
    <InvoiceDetailClient
      invoice={normalizedInvoice}
      lineItems={lineItems || []}
      payments={payments}
      tenant={normalizedTenant}
      readOnly={true}
    />
  );
}
