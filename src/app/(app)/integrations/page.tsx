import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import ConnectedServicesClient from "./ConnectedServicesClient";
import ShopifySyncPanel from "./ShopifySyncPanel";
import MailchimpPanel from "./MailchimpPanel";
import WooSyncPanel from "./WooSyncPanel";
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

      {/* E-commerce Sync Section */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-1">E-commerce Sync</h2>
        <p className="text-sm text-stone-500 mb-4">Two-way sync between Nexpura and your online stores.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ShopifySyncPanel
            isConnected={integrations.some(i => i.type === "shopify" && i.status === "connected")}
            lastSyncAt={integrations.find(i => i.type === "shopify")?.last_sync_at}
          />
          <WooSyncPanel
            isConnected={integrations.some(i => i.type === "woocommerce" && i.status === "connected")}
            lastSyncAt={integrations.find(i => i.type === "woocommerce")?.last_sync_at}
          />
        </div>
      </div>

      {/* Email Marketing Section */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-1">Email Marketing</h2>
        <p className="text-sm text-stone-500 mb-4">Sync customers to your email marketing platform.</p>
        <div className="max-w-sm">
          <MailchimpPanel
            isConnected={integrations.some(i => i.type === "mailchimp" && i.status === "connected")}
            lastSyncAt={integrations.find(i => i.type === "mailchimp")?.last_sync_at}
          />
        </div>
      </div>
    </div>
  );
}
