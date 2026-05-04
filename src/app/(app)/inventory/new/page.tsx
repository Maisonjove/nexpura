import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import InventoryForm from "../InventoryForm";

export default async function NewInventoryPage() {
  const [headersList, supabase] = await Promise.all([headers(), createClient()]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const { data: categories } = await supabase
    .from("stock_categories")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  return (
    <InventoryForm
      categories={categories ?? []}
      mode="create"
    />
  );
}
