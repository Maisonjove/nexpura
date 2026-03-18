import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import CampaignDetailClient from "./CampaignDetailClient";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id ?? "";

  const { data: campaign } = await admin
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!campaign) notFound();

  return (
    <CampaignDetailClient
      campaign={{
        ...campaign,
        stats: (campaign.stats as { sent: number; delivered: number; failed: number }) || { sent: 0, delivered: 0, failed: 0 },
        recipient_filter: (campaign.recipient_filter as { segment_id?: string; tags?: string[]; customer_ids?: string[] }) || {},
      }}
    />
  );
}
