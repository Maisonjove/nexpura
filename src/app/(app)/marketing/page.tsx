import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MarketingOverviewClient from "./MarketingOverviewClient";

export const metadata = { title: "Marketing — Nexpura" };

export default async function MarketingPage() {
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
  const businessName = tenantData?.business_name || tenantData?.name || "Your Business";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch all stats in parallel
  const [
    campaignsResult,
    emailsSentResult,
    segmentsResult,
    templatesResult,
    automationsResult,
    recentCampaignsResult,
  ] = await Promise.all([
    // Total campaigns
    admin
      .from("email_campaigns")
      .select("id, status", { count: "exact" })
      .eq("tenant_id", tenantId),
    
    // Emails sent this month
    admin
      .from("email_sends")
      .select("id, status, opened_at, clicked_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .gte("sent_at", monthStart),

    // Segments count
    admin
      .from("customer_segments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),

    // Templates count
    admin
      .from("email_templates")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),

    // Enabled automations
    admin
      .from("marketing_automations")
      .select("id, enabled")
      .eq("tenant_id", tenantId),

    // Recent campaigns
    admin
      .from("email_campaigns")
      .select("id, name, subject, status, stats, sent_at, scheduled_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Calculate stats
  const totalCampaigns = campaignsResult.count || 0;
  const activeCampaigns = (campaignsResult.data || []).filter(c => c.status === 'scheduled' || c.status === 'sending').length;
  
  const emailsSentThisMonth = emailsSentResult.count || 0;
  const emailsOpened = (emailsSentResult.data || []).filter(e => e.opened_at).length;
  const emailsClicked = (emailsSentResult.data || []).filter(e => e.clicked_at).length;
  
  const openRate = emailsSentThisMonth > 0 ? Math.round((emailsOpened / emailsSentThisMonth) * 100) : 0;
  const clickRate = emailsSentThisMonth > 0 ? Math.round((emailsClicked / emailsSentThisMonth) * 100) : 0;
  
  const totalSegments = segmentsResult.count || 0;
  const totalTemplates = templatesResult.count || 0;
  
  const enabledAutomations = (automationsResult.data || []).filter(a => a.enabled).length;
  const totalAutomations = (automationsResult.data || []).length;

  const stats = {
    emailsSentThisMonth,
    openRate,
    clickRate,
    smsSentThisMonth: 0, // Will implement when SMS is added
    totalCampaigns,
    activeCampaigns,
    totalSegments,
    totalTemplates,
    enabledAutomations,
    totalAutomations,
  };

  const recentCampaigns = (recentCampaignsResult.data || []).map(c => ({
    ...c,
    stats: (c.stats as { sent: number; opened: number; clicked: number; bounced: number }) || { sent: 0, opened: 0, clicked: 0, bounced: 0 },
  }));

  return (
    <MarketingOverviewClient
      stats={stats}
      recentCampaigns={recentCampaigns}
      businessName={businessName}
    />
  );
}
