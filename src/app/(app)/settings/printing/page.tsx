import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PrintingSettingsClient from "./PrintingSettingsClient";

export const metadata = { title: "Printing Settings — Nexpura" };

export default async function PrintingSettingsPage() {
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

  const { data: configs } = await admin
    .from("printer_configs")
    .select("*")
    .eq("tenant_id", tenantId);

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, business_name")
    .eq("id", tenantId)
    .single();

  const configMap: Record<string, Record<string, unknown>> = {};
  for (const c of configs ?? []) {
    configMap[c.printer_type as string] = c;
  }

  return (
    <PrintingSettingsClient
      tenantId={tenantId}
      configs={configMap}
      businessName={tenant?.business_name || tenant?.name || "Your Store"}
    />
  );
}
