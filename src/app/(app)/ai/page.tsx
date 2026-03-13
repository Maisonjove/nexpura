import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import AICopilotClient from "./AICopilotClient";
import { hasPermission } from "@/lib/permissions";

export const metadata = {
  title: "AI Copilot — Nexpura",
};

export default async function AICopilotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, tenants(name, subscriptions(plan, status))")
    .eq("id", user.id)
    .single();

  // Permission check
  if (userData?.tenant_id) {
    const allowed = await hasPermission(user.id, userData.tenant_id, "access_ai");
    if (!allowed) {
      return (
        <div className="max-w-2xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
          <p className="text-stone-500">You don&apos;t have permission to access the AI Copilot.</p>
        </div>
      );
    }
  }

  const tenant = userData?.tenants as {
    name?: string;
    subscriptions?: { plan: string; status: string }[] | { plan: string; status: string } | null;
  } | null;

  let plan = "basic";
  if (tenant?.subscriptions) {
    const subs = Array.isArray(tenant.subscriptions)
      ? tenant.subscriptions[0]
      : tenant.subscriptions;
    if (subs?.plan) plan = subs.plan;
  }

  const canUseAI = plan === "pro" || plan === "ultimate";

  // Fetch existing conversations
  let conversations: { id: string; title: string | null; updated_at: string }[] = [];
  if (canUseAI && userData?.tenant_id) {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("tenant_id", userData.tenant_id)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);
    conversations = data ?? [];
  }

  if (!canUseAI) {
    return (
      <div className="max-w-2xl mx-auto py-20">
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#8B7355]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="font-semibold text-2xl font-semibold text-stone-900 mb-3">
            AI Business Copilot
          </h1>
          <p className="text-stone-500 mb-2">
            AI Business Copilot is available on Pro and Ultimate plans.
          </p>
          <p className="text-stone-400 text-sm mb-7">
            Get intelligent business insights, pricing advice, customer analytics, and more — powered by your actual data.
          </p>
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#8B7355] text-white font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
          >
            Upgrade to Pro →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AICopilotClient
      conversations={conversations}
      plan={plan}
    />
  );
}
