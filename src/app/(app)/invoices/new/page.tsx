import { createClient } from "@/lib/supabase/server";
import InvoiceForm from "../InvoiceForm";
import { redirect } from "next/navigation";

export default async function NewInvoicePage() {
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

  const [{ data: customers }, { data: tenant }, { data: inventoryItems }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId ?? "")
        .is("deleted_at", null)
        .order("full_name"),
      supabase
        .from("tenants")
        .select(
          "name, business_name, tax_name, tax_rate, tax_inclusive, bank_name, bank_bsb, bank_account"
        )
        .eq("id", tenantId ?? "")
        .single(),
      supabase
        .from("inventory")
        .select("id, name, sku, selling_price, description")
        .eq("tenant_id", tenantId ?? "")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name"),
    ]);

  const tenantSettings = {
    name: tenant?.name || null,
    business_name: tenant?.business_name || null,
    tax_name: tenant?.tax_name || "GST",
    tax_rate: tenant?.tax_rate ?? 0.1,
    tax_inclusive: tenant?.tax_inclusive ?? false,
    bank_name: tenant?.bank_name || null,
    bank_bsb: tenant?.bank_bsb || null,
    bank_account: tenant?.bank_account || null,
  };

  return (
    <InvoiceForm
      customers={customers || []}
      tenantSettings={tenantSettings}
      inventoryItems={inventoryItems || []}
    />
  );
}
