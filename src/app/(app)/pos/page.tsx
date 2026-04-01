import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import POSWrapper from "./POSWrapper";

export const metadata = { title: "POS — Nexpura" };

export default async function POSPage() {
  const auth = await requireAuth().catch(() => null);
  if (!auth) redirect("/login");

  const { tenantId, userId, taxRate, businessName } = auth;
  const admin = createAdminClient();

  // Parallel fetch with caching for relatively static data
  const [inventoryItems, customers, tenantSettings] = await Promise.all([
    // Inventory - cache for 30 seconds (frequently changing but not critical)
    getCached(
      tenantCacheKey(tenantId, "pos-inventory"),
      async () => {
        const { data } = await admin
          .from("inventory")
          .select("id, name, sku, retail_price, quantity, primary_image, jewellery_type, item_type, status")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .is("deleted_at", null)
          .gt("quantity", 0)
          .order("name");
        return data ?? [];
      },
      30
    ),
    // Customers - cache for 1 minute (less frequently changing)
    getCached(
      tenantCacheKey(tenantId, "pos-customers"),
      async () => {
        const { data } = await admin
          .from("customers")
          .select("id, full_name, email, store_credit")
          .eq("tenant_id", tenantId)
          .order("full_name");
        return data ?? [];
      },
      60
    ),
    // Tenant Stripe status - cache for 5 minutes
    getCached(
      tenantCacheKey(tenantId, "stripe-status"),
      async () => {
        const { data } = await admin
          .from("tenants")
          .select("stripe_account_id")
          .eq("id", tenantId)
          .maybeSingle();
        return { hasStripe: !!data?.stripe_account_id };
      },
      300
    ),
  ]);

  return (
    <POSWrapper
      tenantId={tenantId}
      userId={userId}
      inventoryItems={inventoryItems}
      customers={customers}
      taxRate={taxRate}
      businessName={businessName ?? "Our Store"}
      hasStripe={tenantSettings.hasStripe}
    />
  );
}
