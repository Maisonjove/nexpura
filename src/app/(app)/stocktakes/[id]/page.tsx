import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import StocktakeDetailClient from "./StocktakeDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: "Stocktake — Nexpura" };
}

export default async function StocktakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");
  const tenantId = userData.tenant_id;

  const admin = createAdminClient();

  const { data: stocktake } = await admin
    .from("stocktakes")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!stocktake) notFound();

  const { data: items } = await admin
    .from("stocktake_items")
    .select("*")
    .eq("stocktake_id", id)
    .order("item_name", { ascending: true });

  return (
    <StocktakeDetailClient
      stocktake={stocktake}
      items={items ?? []}
      tenantId={tenantId}
      userId={user.id}
    />
  );
}
