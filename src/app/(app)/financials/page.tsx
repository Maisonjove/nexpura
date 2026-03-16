import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import FinancialsClient from "./FinancialsClient";

export const metadata = { title: "Financials — Nexpura" };

export default async function FinancialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id, tenants(name, gst_rate, currency)")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = userData.tenants as any;

  return (
    <FinancialsClient
      tenantId={userData.tenant_id}
      businessName={tenant?.name ?? "Your Business"}
      gstRate={tenant?.gst_rate ?? 0.1}
      currency={tenant?.currency ?? "AUD"}
    />
  );
}
