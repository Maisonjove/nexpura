import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import StocktakesClient from "./StocktakesClient";

export const metadata = { title: "Stocktakes — Nexpura" };

export default async function StocktakesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");
  const tenantId = userData.tenant_id;

  const admin = createAdminClient();
  const { data: stocktakes } = await admin
    .from("stocktakes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <StocktakesClient
      stocktakes={stocktakes ?? []}
      tenantId={tenantId}
      userRole={userData.role}
    />
  );
}
