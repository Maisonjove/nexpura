import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { canUseFeature, planDisplayName } from "@/lib/features";
import Link from "next/link";
import SiteConnectClient from "./SiteConnectClient";

export const metadata = { title: "Connect Website — Nexpura" };

export default async function SiteConnectPage() {
  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  // Entitlement gate: Connect Existing Website requires Studio or Atelier
  if (!canUseFeature(ctx.plan, "websiteConnect")) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">🔗</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Connect Existing Website</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            Your current plan <strong className="text-stone-900">{planDisplayName(ctx.plan)}</strong> does not include external website connection.
            Upgrade to <strong className="text-stone-900">Studio</strong> or <strong className="text-stone-900">Atelier</strong> to connect your Shopify, Squarespace, or custom site and embed Nexpura widgets.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-xl font-medium text-sm hover:bg-amber-800 transition-colors"
        >
          Upgrade Plan →
        </Link>
        <p className="text-xs text-stone-400">
          Website Builder and Connect Existing Website are included in Studio ($179/mo) and Atelier ($299/mo).
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: config } = await admin
    .from("website_config")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  return <SiteConnectClient tenantId={ctx.tenantId} config={config} hasWebsite={true} />;
}
