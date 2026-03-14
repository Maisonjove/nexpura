import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TransfersClient from "./TransfersClient";

export const metadata = { title: "Stock Transfers — Nexpura" };

export default async function TransfersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const [{ data: transfers }, { data: locations }, { data: inventory }] = await Promise.all([
    supabase.from("stock_transfers").select("*, from:from_location_id(name), to:to_location_id(name)").eq("tenant_id", userData.tenant_id).order("created_at", { ascending: false }),
    supabase.from("locations").select("*").eq("tenant_id", userData.tenant_id).eq("is_active", true),
    supabase.from("inventory").select("id, name, sku").eq("tenant_id", userData.tenant_id).limit(100),
  ]);

  return (
    <TransfersClient
      tenantId={userData.tenant_id}
      initialTransfers={transfers ?? []}
      locations={locations ?? []}
      inventory={inventory ?? []}
    />
  );
}
