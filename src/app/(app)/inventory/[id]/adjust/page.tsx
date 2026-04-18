import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import AdjustClient from "./AdjustClient";

export const metadata = { title: "Adjust Stock — Nexpura" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdjustStockPage({ params }: PageProps) {
  const [{ id }, headersList, supabase] = await Promise.all([
    params,
    headers(),
    createClient(),
  ]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const { data: item } = await supabase
    .from("inventory")
    .select("id, name, sku, quantity")
    .eq("id", id)
    .eq("tenant_id", tenantId)
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
