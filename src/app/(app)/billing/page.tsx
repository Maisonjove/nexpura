import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BillingClient from "./BillingClient";

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

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .single();

  const { count: userCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", userData.tenant_id);

  return (
    <BillingClient
      subscription={subscription}
      userCount={userCount ?? 0}
    />
  );
}
