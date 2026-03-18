import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import ConnectedServicesClient from "./ConnectedServicesClient";
import { getAllIntegrations } from "@/lib/integrations";

export const metadata = { title: "Connected Services — Nexpura" };

export default async function ConnectedServicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  // Get tenant's Stripe status
  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_customer_id, stripe_account_id")
    .eq("id", ctx.tenantId)
    .single();

  // Get all integrations from integrations table
  const integrations = await getAllIntegrations(ctx.tenantId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Connected Services</h1>
        <p className="text-sm text-stone-500 mt-1">
          See what's connected. Integrations are set up where you use them.
        </p>
      </div>
      
      <ConnectedServicesClient 
        hasStripe={!!tenant?.stripe_account_id}
        integrations={integrations}
      />
    </div>
  );
}
