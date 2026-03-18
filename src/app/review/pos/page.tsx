import { createAdminClient } from "@/lib/supabase/admin";
import POSClient from "@/app/(app)/pos/POSClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ReviewPOSPage() {
  const admin = createAdminClient();

  const { data: inventoryItems } = await admin
    .from("inventory")
    .select("id, name, sku, retail_price, quantity, primary_image, jewellery_type, item_type, status")
    .eq("tenant_id", TENANT_ID)
    .eq("status", "active")
    .is("deleted_at", null)
    .gt("quantity", 0)
    .order("name");

  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, email, store_credit")
    .eq("tenant_id", TENANT_ID)
    .order("full_name");

  const { data: settings } = await admin
    .from("settings")
    .select("tax_rate")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  const taxRate = settings?.tax_rate ?? 0.1;

  const { data: tenantData } = await admin
    .from("tenants")
    .select("name")
    .eq("id", TENANT_ID)
    .maybeSingle();

  const businessName = tenantData?.name ?? "Marcus & Co. Fine Jewellery";

  return (
    <POSClient
      tenantId={TENANT_ID}
      userId={DEMO_USER_ID}
      inventoryItems={inventoryItems ?? []}
      customers={customers ?? []}
      taxRate={taxRate}
      businessName={businessName}
    />
  );
}
