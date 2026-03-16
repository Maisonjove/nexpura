import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { getMaxLocations, planDisplayName } from "@/lib/features";
import LocationsClient from "./LocationsClient";

export const metadata = { title: "Locations — Nexpura" };

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  const admin = createAdminClient();
  const { data: locations } = await admin
    .from("locations")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });

  const maxLocations = getMaxLocations(ctx.plan);
  const currentLocations = locations?.length ?? 0;
  const isAtLimit = maxLocations !== null && currentLocations >= maxLocations;

  return (
    <LocationsClient 
      tenantId={ctx.tenantId} 
      initialLocations={locations ?? []} 
      planName={planDisplayName(ctx.plan)}
      maxLocations={maxLocations}
      isAtLimit={isAtLimit}
    />
  );
}
