import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import IntegrationsClient from "./IntegrationsClient";

export const metadata = { title: "Integrations — Nexpura" };

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  // Get tenant's current integrations
  const { data: tenant } = await supabase
    .from("tenants")
    .select("integrations, stripe_customer_id")
    .eq("id", ctx.tenantId)
    .single();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Integrations</h1>
        <p className="text-sm text-stone-500 mt-1">Connect third-party services to enhance your Nexpura experience.</p>
      </div>
      
      <IntegrationsClient 
        tenantId={ctx.tenantId}
        currentIntegrations={tenant?.integrations || {}}
        hasStripe={!!tenant?.stripe_customer_id}
      />
    </div>
  );
}
