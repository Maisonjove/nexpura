import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import PaymentsClient from "./PaymentsClient";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Payment Settings — Nexpura" };

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  const admin = createAdminClient();
  
  // Get tenant's Stripe status
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_account_id, stripe_customer_id, business_name")
    .eq("id", ctx.tenantId)
    .single();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <a href="/settings" className="text-sm text-amber-600 hover:underline mb-2 inline-block">
          ← Back to Settings
        </a>
        <h1 className="text-2xl font-semibold text-stone-900">Payment Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Connect Stripe to accept card payments from customers.
        </p>
      </div>
      
      <PaymentsClient 
        tenantId={ctx.tenantId}
        stripeAccountId={tenant?.stripe_account_id}
        businessName={tenant?.business_name}
      />
    </div>
  );
}
