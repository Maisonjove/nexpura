import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import WhatsAppCampaignsClient from "./WhatsAppCampaignsClient";

export const metadata = { title: "WhatsApp Campaigns — Nexpura" };

export default async function WhatsAppCampaignsPage({
  searchParams,
}: {
  searchParams: { success?: string; canceled?: string; session_id?: string };
}) {
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

  // Fetch WhatsApp campaigns
  const { data: campaigns } = await admin
    .from("whatsapp_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  // Fetch segments for recipient selection
  const { data: segments } = await admin
    .from("customer_segments")
    .select("id, name, customer_count")
    .eq("tenant_id", tenantId)
    .order("name");

  // Get customer count with phone numbers
  const { count: totalCustomersWithPhone } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("phone", "is", null);

  // Format campaigns with proper typing
  const formattedCampaigns = (campaigns || []).map(c => ({
    ...c,
    stats: (c.stats as { sent: number; delivered: number; failed: number }) || {
      sent: 0,
      delivered: 0,
      failed: 0,
    },
    recipient_filter: (c.recipient_filter as { segment_id?: string; tags?: string[]; customer_ids?: string[] }) || {},
  }));

  // Check URL params for payment status
  const paymentSuccess = searchParams.success === "true";
  const paymentCanceled = searchParams.canceled === "true";
  const stripeSessionId = searchParams.session_id;

  return (
    <WhatsAppCampaignsClient
      campaigns={formattedCampaigns}
      segments={segments || []}
      tenantId={tenantId}
      totalCustomersWithPhone={totalCustomersWithPhone || 0}
      paymentSuccess={paymentSuccess}
      paymentCanceled={paymentCanceled}
      stripeSessionId={stripeSessionId}
    />
  );
}
