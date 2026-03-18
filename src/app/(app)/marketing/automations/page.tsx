import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AutomationsClient from "./AutomationsClient";

export const metadata = { title: "Marketing Automations — Nexpura" };

export default async function AutomationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";

  // Fetch automations
  const { data: automations } = await admin
    .from("marketing_automations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("automation_type");

  // Fetch templates for selection
  const { data: templates } = await admin
    .from("email_templates")
    .select("id, name, template_type")
    .eq("tenant_id", tenantId)
    .order("name");

  // Format automations with proper typing
  const formattedAutomations = (automations || []).map((a) => ({
    ...a,
    settings: (a.settings as Record<string, unknown>) || {},
  }));

  return (
    <AutomationsClient
      automations={formattedAutomations}
      templates={templates || []}
      tenantId={tenantId}
    />
  );
}
