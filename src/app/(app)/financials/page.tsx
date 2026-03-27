import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { canUseFeature, planDisplayName } from "@/lib/features";
import Link from "next/link";
import FinancialsClient from "./FinancialsClient";

export const metadata = { title: "Financials — Nexpura" };

export default async function FinancialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Get session server-side to extract access token for client-side API calls.
  // Cookies are not reliably forwarded to Route Handlers from client fetches,
  // so we pass the token as a prop and use Bearer auth in FinancialsClient.
  const { data: { session } } = await supabase.auth.getSession();
  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/onboarding");

  // Entitlement gate: Full analytics requires Studio or Atelier
  if (!canUseFeature(ctx.plan, "analytics")) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">📊</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Advanced Financials</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            Your current plan <strong className="text-stone-900">{planDisplayName(ctx.plan)}</strong> includes basic dashboard metrics only. Upgrade to <strong className="text-stone-900">Studio</strong> or <strong className="text-stone-900">Atelier</strong> to access deep financial insights, revenue charts, and tax reporting.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-xl font-medium text-sm hover:bg-amber-800 transition-colors"
        >
          Upgrade Plan →
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, tenants(name, gst_rate, currency)")
    .eq("id", user.id)
    .single();

  const tenant = userData?.tenants as { name?: string; gst_rate?: number; currency?: string } | null;

  return (
    <FinancialsClient
      tenantId={ctx.tenantId}
      businessName={tenant?.name ?? "Your Business"}
      gstRate={tenant?.gst_rate ?? 0.1}
      currency={tenant?.currency ?? "AUD"}
      accessToken={session?.access_token ?? ""}
    />
  );
}
