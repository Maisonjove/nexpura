import { createClient } from "@/lib/supabase/server";
import InvoiceForm from "../InvoiceForm";
import { redirect } from "next/navigation";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; bespoke_id?: string; repair_id?: string; sale_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id;
  const sp = await searchParams;

  const [{ data: customers }, { data: tenant }, { data: inventoryItems }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId ?? "")
        .order("full_name"),
      supabase
        .from("tenants")
        .select("name, slug, logo_url")
        .eq("id", tenantId ?? "")
        .single(),
      supabase
        .from("inventory")
        .select("id, name, sku, retail_price, description")
        .eq("tenant_id", tenantId ?? "")
        .order("name"),
    ]);

  // Normalize tenant to what InvoiceForm expects
  const tenantSettings = {
    name: tenant?.name ?? null,
    business_name: tenant?.name ?? null,
    tax_name: "GST",
    tax_rate: 0.1,
    tax_inclusive: true,
    bank_name: null,
    bank_bsb: null,
    bank_account: null,
  };

  // Pre-fill existing if coming from a bespoke/repair/sale context
  const preExisting = (sp.bespoke_id || sp.repair_id || sp.sale_id || sp.customer_id) ? {
    id: "",
    customer_id: sp.customer_id || null,
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: null,
    reference_type: sp.bespoke_id ? "bespoke_job" : sp.repair_id ? "repair" : sp.sale_id ? "sale" : null,
    reference_id: sp.bespoke_id ?? sp.repair_id ?? sp.sale_id ?? null,
    tax_name: "GST",
    tax_rate: 0.1,
    tax_inclusive: true,
    discount_amount: 0,
    notes: null,
    footer_text: null,
    status: "draft" as const,
    line_items: [],
  } : undefined;

  return (
    <InvoiceForm
      customers={customers || []}
      tenantSettings={tenantSettings}
      inventoryItems={inventoryItems || []}
      existing={preExisting}
    />
  );
}
