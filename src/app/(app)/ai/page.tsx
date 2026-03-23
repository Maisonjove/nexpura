import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { planIncludes, PLAN_NAMES, PlanId } from "@/lib/plans";
import Link from "next/link";
import AICopilotClient from "./AICopilotClient";

export const metadata = { title: "AI Business Copilot — Nexpura" };

export default async function AIPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/onboarding");

  // Entitlement gate: AI Copilot is on all plans, but let's be explicit
  if (!planIncludes(ctx.plan as PlanId, 'aiCopilot')) {
    return (
       <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">🤖</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">AI Business Copilot</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            AI features are not enabled on your plan. Upgrade your plan to access the Nexpura AI Business Copilot.
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

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .order("updated_at", { ascending: false });

  return (
    <AICopilotClient 
      conversations={conversations ?? []} 
      plan={PLAN_NAMES[ctx.plan as PlanId]} 
    />
  );
}
