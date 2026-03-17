import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import CopilotClient from "./CopilotClient";

export const metadata = { title: "AI Copilot — Nexpura" };

export default async function CopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

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
