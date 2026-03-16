import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BillingClient from "./BillingClient";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Billing — Nexpura" };

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, full_name, email")
    .eq("id", user.id)
    .single();

  if (!userData) redirect("/onboarding");

  // Permission check
  const allowed = await hasPermission(user.id, userData.tenant_id, "manage_billing");
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to manage billing.</p>
      </div>
    );
  }

  const [subscriptionResult, userCountResult, inventoryCountResult, customerCountResult] = await Promise.all([
    admin.from("subscriptions").select("*").eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", userData.tenant_id),
    admin.from("inventory").select("id", { count: "exact", head: true }).eq("tenant_id", userData.tenant_id),
    admin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", userData.tenant_id),
  ]);

  const subscription = subscriptionResult.data;
  const userCount = userCountResult.count;
  const inventoryCount = inventoryCountResult.count;
  const customerCount = customerCountResult.count;

  return (
    <BillingClient
      subscription={subscription}
      userCount={userCount ?? 0}
      inventoryCount={inventoryCount ?? 0}
      customerCount={customerCount ?? 0}
    />
  );
}
