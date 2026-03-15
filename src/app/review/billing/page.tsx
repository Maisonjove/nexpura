import { createAdminClient } from "@/lib/supabase/admin";
import BillingClient from "@/app/(app)/billing/BillingClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewBillingPage() {
  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .single();

  const [{ count: userCount }, { count: inventoryCount }, { count: customerCount }] =
    await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID),
      admin.from("inventory").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID),
      admin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID),
    ]);

  return (
    <BillingClient
      subscription={subscription}
      userCount={userCount ?? 0}
      inventoryCount={inventoryCount ?? 0}
      customerCount={customerCount ?? 0}
    />
  );
}
