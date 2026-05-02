import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import MarketingHubClient from "./MarketingHubClient";

export const metadata = { title: "Marketing — Nexpura" };

/**
 * Marketing Hub — Section 9 of Kaitlyn's 2026-05-02 redesign brief.
 *
 * Replaces the legacy dark-themed MarketingOverviewClient with the ivory
 * hub shell. The KPI strip is server-computed (campaigns / drafts /
 * segments / scheduled msgs / automations).
 */
export default async function MarketingPage() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const admin = createAdminClient();

  const nowIso = new Date().toISOString();

  const [
    campaignsResult,
    segmentsResult,
    scheduledEmailsResult,
    automationsResult,
    recentCampaignsResult,
  ] = await Promise.all([
    // All campaigns + status (for active / drafts breakdown)
    admin
      .from("email_campaigns")
      .select("id, status")
      .eq("tenant_id", tenantId),
    admin
      .from("customer_segments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    // Scheduled email sends in the future. Schema-tolerant — null/error → 0.
    admin
      .from("email_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "scheduled")
      .gte("scheduled_at", nowIso),
    admin
      .from("marketing_automations")
      .select("id, enabled")
      .eq("tenant_id", tenantId),
    admin
      .from("email_campaigns")
      .select("id, name, subject, status, sent_at, scheduled_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const campaigns = campaignsResult.data ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "scheduled" || c.status === "sending").length;
  const drafts = campaigns.filter((c) => c.status === "draft").length;
  const segments = segmentsResult.count ?? 0;
  const scheduledMessages = scheduledEmailsResult.error ? 0 : (scheduledEmailsResult.count ?? 0);
  const enabledAutomations = (automationsResult.data ?? []).filter((a) => a.enabled).length;
  const recentCampaigns = recentCampaignsResult.data ?? [];

  return (
    <MarketingHubClient
      kpis={{
        activeCampaigns,
        drafts,
        segments,
        scheduledMessages,
        enabledAutomations,
      }}
      recentCampaigns={recentCampaigns}
    />
  );
}
