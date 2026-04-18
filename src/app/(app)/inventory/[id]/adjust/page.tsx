import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import AdjustClient from "./AdjustClient";

export const metadata = { title: "Adjust Stock — Nexpura" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdjustStockPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const { data: item } = await supabase
    .from("inventory")
    .select("id, name, sku, quantity")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!item) notFound();

  return (
    <AdjustClient
      inventoryId={item.id}
      itemName={item.name}
      itemSku={item.sku}
      currentQty={item.quantity}
    />
  );
}
