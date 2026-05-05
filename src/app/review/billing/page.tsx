import { createAdminClient } from "@/lib/supabase/admin";
import BillingClient from "@/app/(app)/billing/BillingClient";
import { getEntitlementContext } from "@/lib/auth/entitlements";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";


export default async function ReviewBillingPage() {
  const admin = createAdminClient();
  const ctx = await getEntitlementContext();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ count: userCount }, { count: inventoryCount }, { count: customerCount }] =
    await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID),
      admin.from("inventory").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID),
      admin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID),
    ]);

  return (
    <div className="space-y-4">
      {/* Review note for Stripe */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <span className="font-semibold">Demo billing history:</span> No live Stripe billing is connected to this review tenant.
        The subscription plan (Pro, active) and plan comparison below reflect the real app logic.
        Invoice history and payment method management require a live Stripe account.
      </div>

      <BillingClient
        tenantId={ctx.tenantId!}
        currentPlan={ctx.plan}
        subscriptionStatus={subscription?.status ?? "trialing"}
        trialEndsAt={subscription?.trial_ends_at ?? new Date(Date.now() + 14 * 86400000).toISOString()}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        subdomain=""
        email="review@nexpura.com"
        currency="AUD"
        tenantTimezone={null}
      />
    </div>
  );
}
