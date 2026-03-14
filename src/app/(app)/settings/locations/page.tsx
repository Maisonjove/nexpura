import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LocationsClient from "./LocationsClient";

export const metadata = { title: "Locations — Nexpura" };

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("tenant_id", userData.tenant_id)
    .order("created_at", { ascending: true });

  return <LocationsClient tenantId={userData.tenant_id} initialLocations={locations ?? []} />;
}
