import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PurchaseOrdersClient from "./PurchaseOrdersClient";

export default async function PurchaseOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", id)
    .eq("tenant_id", tenantId ?? "")
    .single();

  if (!supplier) notFound();

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("tenant_id", tenantId ?? "")
    .eq("supplier_id", id)
    .order("created_at", { ascending: false });

  return <PurchaseOrdersClient supplier={supplier} orders={orders ?? []} />;
}
