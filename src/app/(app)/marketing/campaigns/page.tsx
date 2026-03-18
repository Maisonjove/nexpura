import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CampaignsClient from "./CampaignsClient";

export const metadata = { title: "Email Campaigns — Nexpura" };

export default async function CampaignsPage() {
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

  // Fetch campaigns
  const { data: campaigns } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

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

  // Format campaigns with proper stats typing
  const formattedCampaigns = (campaigns || []).map(c => ({
    ...c,
    stats: (c.stats as { sent: number; opened: number; clicked: number; bounced: number }) || {
      sent: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
    },
    recipient_filter: (c.recipient_filter as { segment_id?: string; tags?: string[]; customer_ids?: string[] }) || {},
  }));

  return (
    <CampaignsClient
      campaigns={formattedCampaigns}
      segments={segments || []}
      templates={templates || []}
      tenantId={tenantId}
    />
  );
}
