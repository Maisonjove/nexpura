import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BillingClient from "./BillingClient";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Billing — Nexpura" };

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
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

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .single();

  const { count: userCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", userData.tenant_id);

  const { count: inventoryCount } = await supabase
    .from("inventory")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", userData.tenant_id);

  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", userData.tenant_id);

  return (
    <BillingClient
      subscription={subscription}
      userCount={userCount ?? 0}
      inventoryCount={inventoryCount ?? 0}
      customerCount={customerCount ?? 0}
    />
  );
}
