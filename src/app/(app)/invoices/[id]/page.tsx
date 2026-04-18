import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import InvoiceDetailClient from "./InvoiceDetailClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rt?: string }>;
}) {
  const [{ id }, sp, headersList] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { rt?: string }),
    headers(),
  ]);
  const adminClient = createAdminClient();

  let tenantId: string | null;
  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    // Middleware already resolved the tenant for this authenticated request
    // and put it in the AUTH_HEADERS — skipping the auth.getUser + users
    // SELECT round-trips shaves ~60-150ms off every detail-page render.
    tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
    if (!tenantId) redirect("/login");
  }

  const [{ data: invoice }, { data: lineItems }, { data: tenant }, { data: paymentsRaw }] =
    await Promise.all([
      adminClient
        .from("invoices")
        .select(
          `id, invoice_number, status, invoice_date, due_date, paid_at,
           subtotal, tax_amount, discount_amount, total, amount_paid,
           tax_name, tax_rate, tax_inclusive, notes, footer_text, reference_type,
           created_at, stripe_payment_link,
           customers(id, full_name, email, phone, mobile, address_line1, suburb, state, postcode)`
        )
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single(),
      adminClient
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, discount_pct, total, sort_order")
        .eq("invoice_id", id)
        .order("sort_order"),
      adminClient
        .from("tenants")
        .select("name, slug, logo_url, brand_color, business_name, abn, phone, email, address_line1, suburb, state, postcode, bank_name, bank_bsb, bank_account, invoice_footer")
        .eq("id", tenantId ?? "")
        .single(),
      // Fetch real payment records — balance due = total - sum(payments)
      adminClient
        .from("payments")
        .select("id, amount, payment_method, payment_date, reference, notes, created_at")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: true }),
    ]);

  if (!invoice) notFound();

  // Normalize customer join (Supabase may return array)
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

  // Calculate amount_paid dynamically from payment records
  // Fall back to invoice.amount_paid if no payment records exist yet
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

  // Normalize tenant to full shape including bank details and ABN
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
      readOnly={isReviewMode}
    />
  );
}
