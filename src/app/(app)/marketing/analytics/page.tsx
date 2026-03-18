import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart2,
  Mail,
  Eye,
  MousePointer,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export const metadata = { title: "Marketing Analytics — Nexpura" };

export default async function AnalyticsPage() {
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

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  // Fetch stats for this month and last month
  const [thisMonthEmails, lastMonthEmails, thisMonthSMS, lastMonthSMS, topCampaigns] =
    await Promise.all([
      // This month emails
      admin
        .from("email_sends")
        .select("id, status, opened_at, clicked_at")
        .eq("tenant_id", tenantId)
        .gte("sent_at", thisMonthStart),

      // Last month emails
      admin
        .from("email_sends")
        .select("id, status, opened_at, clicked_at")
        .eq("tenant_id", tenantId)
        .gte("sent_at", lastMonthStart)
        .lt("sent_at", lastMonthEnd),

      // This month SMS
      admin
        .from("sms_sends")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .gte("sent_at", thisMonthStart),

      // Last month SMS
      admin
        .from("sms_sends")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .gte("sent_at", lastMonthStart)
        .lt("sent_at", lastMonthEnd),

      // Top campaigns
      admin
        .from("email_campaigns")
        .select("id, name, stats, sent_at")
        .eq("tenant_id", tenantId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(5),
    ]);

  // Calculate metrics
  const thisMonthEmailCount = thisMonthEmails.data?.length || 0;
  const lastMonthEmailCount = lastMonthEmails.data?.length || 0;
  const thisMonthOpened = thisMonthEmails.data?.filter((e) => e.opened_at).length || 0;
  const thisMonthClicked = thisMonthEmails.data?.filter((e) => e.clicked_at).length || 0;
  const lastMonthOpened = lastMonthEmails.data?.filter((e) => e.opened_at).length || 0;
  const lastMonthClicked = lastMonthEmails.data?.filter((e) => e.clicked_at).length || 0;

  const thisMonthOpenRate = thisMonthEmailCount > 0 ? Math.round((thisMonthOpened / thisMonthEmailCount) * 100) : 0;
  const lastMonthOpenRate = lastMonthEmailCount > 0 ? Math.round((lastMonthOpened / lastMonthEmailCount) * 100) : 0;
  const thisMonthClickRate = thisMonthEmailCount > 0 ? Math.round((thisMonthClicked / thisMonthEmailCount) * 100) : 0;
  const lastMonthClickRate = lastMonthEmailCount > 0 ? Math.round((lastMonthClicked / lastMonthEmailCount) * 100) : 0;

  const thisMonthSMSCount = thisMonthSMS.data?.length || 0;
  const lastMonthSMSCount = lastMonthSMS.data?.length || 0;

  function getTrend(current: number, previous: number) {
    if (previous === 0) return { direction: "neutral", change: 0 };
    const change = Math.round(((current - previous) / previous) * 100);
    return {
      direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      change: Math.abs(change),
    };
  }

  const emailTrend = getTrend(thisMonthEmailCount, lastMonthEmailCount);
  const openRateTrend = getTrend(thisMonthOpenRate, lastMonthOpenRate);
  const clickRateTrend = getTrend(thisMonthClickRate, lastMonthClickRate);
  const smsTrend = getTrend(thisMonthSMSCount, lastMonthSMSCount);

  function TrendIcon({ direction }: { direction: string }) {
    if (direction === "up") return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (direction === "down") return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-stone-500" />;
  }

  const formattedCampaigns = (topCampaigns.data || []).map((c) => ({
    ...c,
    stats: (c.stats as { sent: number; opened: number; clicked: number }) || { sent: 0, opened: 0, clicked: 0 },
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/marketing"
          className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-amber-400" />
            Marketing Analytics
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Performance metrics for your marketing campaigns
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              Emails Sent
            </span>
            <Mail className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">{thisMonthEmailCount}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon direction={emailTrend.direction} />
            <span
              className={`text-xs ${
                emailTrend.direction === "up"
                  ? "text-green-400"
                  : emailTrend.direction === "down"
                  ? "text-red-400"
                  : "text-stone-500"
              }`}
            >
              {emailTrend.change}% vs last month
            </span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              Open Rate
            </span>
            <Eye className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">{thisMonthOpenRate}%</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon direction={openRateTrend.direction} />
            <span
              className={`text-xs ${
                openRateTrend.direction === "up"
                  ? "text-green-400"
                  : openRateTrend.direction === "down"
                  ? "text-red-400"
                  : "text-stone-500"
              }`}
            >
              {openRateTrend.change}% vs last month
            </span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              Click Rate
            </span>
            <MousePointer className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">{thisMonthClickRate}%</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon direction={clickRateTrend.direction} />
            <span
              className={`text-xs ${
                clickRateTrend.direction === "up"
                  ? "text-green-400"
                  : clickRateTrend.direction === "down"
                  ? "text-red-400"
                  : "text-stone-500"
              }`}
            >
              {clickRateTrend.change}% vs last month
            </span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              SMS Sent
            </span>
            <MessageSquare className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">{thisMonthSMSCount}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon direction={smsTrend.direction} />
            <span
              className={`text-xs ${
                smsTrend.direction === "up"
                  ? "text-green-400"
                  : smsTrend.direction === "down"
                  ? "text-red-400"
                  : "text-stone-500"
              }`}
            >
              {smsTrend.change}% vs last month
            </span>
          </div>
        </div>
      </div>

      {/* Top Campaigns */}
      <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">Recent Campaign Performance</h2>
        </div>
        {formattedCampaigns.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-8 h-8 text-stone-600 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">No sent campaigns yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {formattedCampaigns.map((campaign) => (
              <div key={campaign.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{campaign.name}</h3>
                  <span className="text-xs text-stone-500">
                    {campaign.sent_at
                      ? new Date(campaign.sent_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-stone-500">Sent:</span>{" "}
                    <span className="text-white">{campaign.stats.sent}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Opened:</span>{" "}
                    <span className="text-white">{campaign.stats.opened}</span>
                    <span className="text-stone-500 ml-1">
                      (
                      {campaign.stats.sent > 0
                        ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500">Clicked:</span>{" "}
                    <span className="text-white">{campaign.stats.clicked}</span>
                    <span className="text-stone-500 ml-1">
                      (
                      {campaign.stats.sent > 0
                        ? Math.round((campaign.stats.clicked / campaign.stats.sent) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benchmarks */}
      <div className="mt-8 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-3">📊 Industry Benchmarks (Jewelry Retail)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-stone-400">Average Open Rate</p>
            <p className="text-white font-medium">15-25%</p>
          </div>
          <div>
            <p className="text-stone-400">Average Click Rate</p>
            <p className="text-white font-medium">2-5%</p>
          </div>
          <div>
            <p className="text-stone-400">Best Send Times</p>
            <p className="text-white font-medium">Tue-Thu, 10am</p>
          </div>
        </div>
      </div>
    </div>
  );
}
