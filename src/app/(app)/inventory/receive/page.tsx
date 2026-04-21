import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import BatchReceiveClient from "./BatchReceiveClient";

export const metadata = { title: "Receive Stock — Nexpura" };

export default async function BatchReceivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  const tenantId = userData.tenant_id;
  const admin = createAdminClient();

  const [{ data: suppliers }, { data: inventoryItems }] = await Promise.all([
    admin
      .from("suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name"),
    admin
      .from("inventory")
      .select("id, name, sku, quantity")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name"),
  ]);

  return (
    <BatchReceiveClient
      suppliers={suppliers ?? []}
      inventoryItems={inventoryItems ?? []}
    />
  );
}
