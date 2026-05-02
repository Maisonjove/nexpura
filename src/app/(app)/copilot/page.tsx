import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import Link from "next/link";
import { planIncludes, PlanId } from "@/lib/plans";
import CopilotClient from "./CopilotClient";

export const metadata = { title: "AI Copilot — Nexpura" };

export default async function CopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  if (!planIncludes(ctx.plan as PlanId, 'aiCopilot')) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">🤖</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">AI Copilot</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            AI Copilot is available on Studio and above. Upgrade your plan to access this feature.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-nexpura-charcoal text-white rounded-xl font-medium text-sm hover:bg-nexpura-charcoal-700 transition-colors"
        >
          Upgrade Plan →
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const firstName = userData?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">AI Copilot</h1>
        <p className="text-sm text-stone-500 mt-1">Your intelligent business insights assistant.</p>
      </div>
      
      <CopilotClient firstName={firstName} tenantId={ctx.tenantId} />
    </div>
  );
}
