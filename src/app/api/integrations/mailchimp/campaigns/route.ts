/**
 * GET /api/integrations/mailchimp/campaigns
 * 
 * Fetches campaign analytics from Mailchimp and stores in DB for historical tracking.
 * Returns open rates, click rates, and other stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, getIntegration, upsertIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

interface MailchimpCampaign {
  id: string;
  web_id: number;
  type: string;
  create_time: string;
  send_time: string | null;
  emails_sent: number;
  status: string;
  settings: {
    subject_line: string;
    title: string;
    from_name: string;
    reply_to: string;
  };
  report_summary?: {
    opens: number;
    unique_opens: number;
    open_rate: number;
    clicks: number;
    subscriber_clicks: number;
    click_rate: number;
    unsubscribes?: number;
    bounce_rate?: number;
  };
}

interface MailchimpConfig {
  api_key: string;
  server_prefix: string;
  list_id: string;
}

function getServerPrefix(apiKey: string): string {
  const parts = apiKey.split("-");
  return parts[parts.length - 1] || "us1";
}

async function mailchimpFetch(
  apiKey: string,
  serverPrefix: string,
  path: string
) {
  const url = `https://${serverPrefix}.api.mailchimp.com/3.0${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Mailchimp API error ${res.status}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { tenantId } = await getAuthContext();
    
    const integration = await getIntegration(tenantId, "mailchimp" as any);
    if (!integration) {
      return NextResponse.json({ error: "Mailchimp not connected" }, { status: 400 });
    }

    const config = integration.config as unknown as MailchimpConfig;
    const { api_key } = config;
    const serverPrefix = config.server_prefix || getServerPrefix(api_key);

    // Fetch campaigns with report summary
    const data = await mailchimpFetch(
      api_key,
      serverPrefix,
      "/campaigns?count=50&status=sent&sort_field=send_time&sort_dir=DESC&fields=campaigns.id,campaigns.web_id,campaigns.type,campaigns.create_time,campaigns.send_time,campaigns.emails_sent,campaigns.status,campaigns.settings,campaigns.report_summary"
    );

    const campaigns: MailchimpCampaign[] = data.campaigns || [];

    // Store campaign analytics in DB for historical tracking
    const admin = createAdminClient();

    for (const campaign of campaigns) {
      if (!campaign.report_summary) continue;

      const analyticsData = {
        tenant_id: tenantId,
        mailchimp_campaign_id: campaign.id,
        title: campaign.settings.title,
        subject: campaign.settings.subject_line,
        sent_at: campaign.send_time,
        emails_sent: campaign.emails_sent,
        opens: campaign.report_summary.opens,
        unique_opens: campaign.report_summary.unique_opens,
        open_rate: campaign.report_summary.open_rate,
        clicks: campaign.report_summary.clicks,
        subscriber_clicks: campaign.report_summary.subscriber_clicks,
        click_rate: campaign.report_summary.click_rate,
        unsubscribes: campaign.report_summary.unsubscribes || 0,
        bounce_rate: campaign.report_summary.bounce_rate || 0,
        fetched_at: new Date().toISOString(),
      };

      // Upsert analytics record
      await admin.from("mailchimp_campaign_analytics").upsert(
        analyticsData,
        { onConflict: "tenant_id,mailchimp_campaign_id", ignoreDuplicates: false }
      );

      // Sync individual unsubscribes back to customers.email_opted_out.
      // Without this a customer who unsubs via Mailchimp keeps receiving
      // our other channels (WhatsApp, transactional email, etc.) — a
      // direct compliance miss (CAN-SPAM, GDPR honour-the-unsubscribe).
      // Best-effort: log + continue if Mailchimp errors, since the
      // analytics record already landed and we don't want to fail the
      // whole sync over a single endpoint hiccup.
      if ((campaign.report_summary.unsubscribes ?? 0) > 0) {
        try {
          const unsubData = await mailchimpFetch(
            api_key,
            serverPrefix,
            `/reports/${campaign.id}/unsubscribed?count=1000&fields=unsubscribes.email_address`,
          );
          const unsubEmails: string[] = (unsubData?.unsubscribes ?? [])
            .map((u: { email_address?: string }) => u.email_address)
            .filter((e: unknown): e is string => typeof e === "string" && e.length > 0)
            .map((e: string) => e.toLowerCase());

          if (unsubEmails.length > 0) {
            await admin
              .from("customers")
              .update({
                email_opted_out: true,
                email_opted_out_at: new Date().toISOString(),
              })
              .eq("tenant_id", tenantId)
              .in("email", unsubEmails);
          }
        } catch (e) {
          logger.error("[mailchimp/campaigns] unsubscribe sync failed for campaign", {
            campaignId: campaign.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Update last sync time
    await upsertIntegration(tenantId, "mailchimp" as any, {
      ...config,
      last_analytics_sync: new Date().toISOString(),
    });

    // Return formatted data for UI
    const formattedCampaigns = campaigns.map(c => ({
      id: c.id,
      title: c.settings.title,
      subject: c.settings.subject_line,
      sentAt: c.send_time,
      emailsSent: c.emails_sent,
      stats: c.report_summary ? {
        opens: c.report_summary.opens,
        uniqueOpens: c.report_summary.unique_opens,
        openRate: (c.report_summary.open_rate * 100).toFixed(1) + "%",
        clicks: c.report_summary.clicks,
        subscriberClicks: c.report_summary.subscriber_clicks,
        clickRate: (c.report_summary.click_rate * 100).toFixed(1) + "%",
        unsubscribes: c.report_summary.unsubscribes || 0,
        bounceRate: ((c.report_summary.bounce_rate || 0) * 100).toFixed(1) + "%",
      } : null,
    }));

    return NextResponse.json({
      success: true,
      campaigns: formattedCampaigns,
      count: formattedCampaigns.length,
    });
  } catch (err) {
    logger.error("[mailchimp/campaigns]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
