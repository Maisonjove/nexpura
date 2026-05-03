import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TemplatesClient from "./TemplatesClient";

export const metadata = { title: "Email Templates — Nexpura" };

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, tenants(name, business_name)")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";
  const tenantData = userData?.tenants as { name?: string; business_name?: string } | null;
  const businessName = tenantData?.business_name || tenantData?.name || "Business";

  // Fetch templates
  const { data: templates } = await admin
    .from("email_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  // Format templates with proper typing
  const formattedTemplates = (templates || []).map((t) => ({
    ...t,
    variables: (t.variables as string[]) || [],
  }));

  return (
    <TemplatesClient
      templates={formattedTemplates}
      tenantId={tenantId}
      businessName={businessName}
    />
  );
}
