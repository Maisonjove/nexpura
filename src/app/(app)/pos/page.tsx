import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import POSClient from "./POSClient";

export const metadata = { title: "POS — Nexpura" };

export default async function POSPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Use admin for user lookup to bypass RLS recursion/timeouts
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, full_name")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  const tenantId = userData.tenant_id;

  // Fetch inventory items
  const { data: inventoryItems } = await admin
    .from("inventory")
    .select("id, name, sku, retail_price, quantity, primary_image, jewellery_type, item_type, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .gt("quantity", 0)
    .order("name");

  // Fetch customers
  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, email, store_credit")
    .eq("tenant_id", tenantId)
    .order("full_name");

  // Fetch settings for tax rate
  const { data: settings } = await admin
    .from("settings")
    .select("tax_rate")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const taxRate = settings?.tax_rate ?? 0.1;

  // Fetch tenant business name for receipt branding
  const { data: tenantData } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  const businessName = tenantData?.name ?? "Our Store";

  return (
    <POSClient
      tenantId={tenantId}
      userId={user.id}
      inventoryItems={inventoryItems ?? []}
      customers={customers ?? []}
      taxRate={taxRate}
      businessName={businessName}
    />
  );
}
