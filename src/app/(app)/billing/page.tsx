import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import BillingClient from "./BillingClient";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/data/pricing";

export const metadata = { title: "Billing — Nexpura" };

export default async function BillingPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { userId, tenantId, email, permissions } = auth;

  // Permission check
  if (!permissions.manage_billing) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">You don&apos;t have permission to manage billing.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  // Parallel fetch - subscription + entitlements + website config + tenant currency
  const [subscriptionResult, ctx, websiteData, tenantRow] = await Promise.all([
    admin
      .from("subscriptions")
      .select("status, trial_ends_at, current_period_end")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getEntitlementContext(),
    getCached(
      tenantCacheKey(tenantId, "website-subdomain"),
      async () => {
        const { data } = await admin
          .from("website_config")
          .select("subdomain")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        return data;
      },
      300
    ),
    admin.from("tenants").select("currency").eq("id", tenantId).single(),
  ]);

  const subscription = subscriptionResult.data;
  const tenantCurrency: CurrencyCode = SUPPORTED_CURRENCIES.includes(
    (tenantRow.data?.currency ?? "").toUpperCase() as CurrencyCode,
  )
    ? (tenantRow.data!.currency!.toUpperCase() as CurrencyCode)
    : "AUD";

  return (
    <BillingClient
      tenantId={ctx.tenantId!}
      currentPlan={ctx.plan}
      subscriptionStatus={subscription?.status ?? "trialing"}
      trialEndsAt={subscription?.trial_ends_at ?? new Date(Date.now() + 14 * 86400000).toISOString()}
      currentPeriodEnd={subscription?.current_period_end ?? null}
      subdomain={websiteData?.subdomain ?? ctx.tenantId ?? ""}
      email={email ?? ""}
      currency={tenantCurrency}
    />
  );
}
