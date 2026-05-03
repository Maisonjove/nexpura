import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CampaignFormClient from "./CampaignFormClient";

export const metadata = { title: "New Campaign — Nexpura" };

export default async function NewCampaignPage() {
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

  // Fetch segments for recipient selection
  const { data: segments } = await admin
    .from("customer_segments")
    .select("id, name, customer_count")
    .eq("tenant_id", tenantId)
    .order("name");

  // Fetch templates
  const { data: templates } = await admin
    .from("email_templates")
    .select("id, name, subject, body, template_type")
    .eq("tenant_id", tenantId)
    .order("name");

  // Fetch customer tags
  const { data: customers } = await admin
    .from("customers")
    .select("tags")
    .eq("tenant_id", tenantId)
    .not("tags", "is", null);

  const allTags = [...new Set((customers || []).flatMap((c) => c.tags || []))].sort();

  return (
    <CampaignFormClient
      segments={segments || []}
      templates={templates || []}
      tags={allTags}
      businessName={businessName}
    />
  );
}
