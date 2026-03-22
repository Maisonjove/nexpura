import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import InvoiceForm from "../../InvoiceForm";

export default async function EditInvoicePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const tenantId = userData?.tenant_id;

  const [
    { data: invoice },
    { data: lineItems },
    { data: customers },
    { data: tenant },
    { data: inventoryItems },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select(
                    "id, customer_id, invoice_date, due_date, reference_type, reference_id, tax_name, tax_rate, tax_inclusive, discount_amount, notes, footer_text, status, layout"
                  )
          .eq("id", id)
          .eq("tenant_id", tenantId ?? "")
          .single(),
        supabase
          .from("invoice_line_items")
          .select("id, description, quantity, unit_price, discount_pct, sort_order, inventory_id")
          .eq("invoice_id", id)
          .order("sort_order"),
        supabase
          .from("customers")
          .select("id, full_name, email")
          .eq("tenant_id", tenantId ?? "")
          .order("full_name"),
        supabase
          .from("tenants")
          .select("name, slug, logo_url, tax_name, tax_rate, tax_inclusive, bank_name, bank_bsb, bank_account")
          .eq("id", tenantId ?? "")
          .single(),
        supabase
          .from("inventory")
          .select("id, name, sku, retail_price, description")
          .eq("tenant_id", tenantId ?? "")
          .order("name"),
      ]);

  if (!invoice) notFound();

  // Use tenant's configured tax settings as defaults; fall back to what's on the invoice
  const defaultTaxName = tenant?.tax_name || invoice.tax_name || "GST";
    const defaultTaxRate = tenant?.tax_rate ?? invoice.tax_rate ?? 0.1;
    const defaultTaxInclusive = tenant?.tax_inclusive ?? invoice.tax_inclusive ?? true;

  const tenantSettings = {
        name: tenant?.name || null,
        business_name: tenant?.name || null,
        tax_name: defaultTaxName,
        tax_rate: defaultTaxRate,
        tax_inclusive: defaultTaxInclusive,
        bank_name: tenant?.bank_name ?? null,
        bank_bsb: tenant?.bank_bsb ?? null,
        bank_account: tenant?.bank_account ?? null,
  };

  const existingData = {
        id: invoice.id,
        customer_id: invoice.customer_id,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        reference_type: invoice.reference_type,
        reference_id: invoice.reference_id,
        tax_name: invoice.tax_name || defaultTaxName,
        tax_rate: invoice.tax_rate ?? defaultTaxRate,
        tax_inclusive: invoice.tax_inclusive ?? defaultTaxInclusive,
        discount_amount: invoice.discount_amount || 0,
        notes: invoice.notes,
        footer_text: invoice.footer_text,
        status: invoice.status,
        layout: invoice.layout ?? 'classic',
        line_items: (lineItems || []).map((li) => ({
                id: li.id,
                description: li.description,
                quantity: li.quantity,
                unit_price: li.unit_price,
                discount_pct: li.discount_pct || 0,
                sort_order: li.sort_order || 0,
                inventory_id: li.inventory_id,
        })),
  };

  return (
        <InvoiceForm
                customers={customers || []}
                tenantSettings={tenantSettings}
                existing={existingData}
                inventoryItems={inventoryItems || []}
              />
      );
}
