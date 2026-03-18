"use client";

import Link from "next/link";
import {
  Megaphone,
  Mail,
  Send,
  MessageSquare,
  Zap,
  Users,
  FileText,
  BarChart2,
  TrendingUp,
  ArrowRight,
  Eye,
  MousePointer,
  CheckCircle2,
  DollarSign,
} from "lucide-react";

interface Stats {
  emailsSentThisMonth: number;
  openRate: number;
  clickRate: number;
  smsSentThisMonth: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSegments: number;
  totalTemplates: number;
  enabledAutomations: number;
  totalAutomations: number;
  whatsappCampaigns: number;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  stats: { sent: number; opened: number; clicked: number; bounced: number };
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface Props {
  stats: Stats;
  recentCampaigns: Campaign[];
  businessName: string;
}

const quickActions = [
  {
    name: "WhatsApp Campaign",
    description: "Send marketing messages via WhatsApp",
    href: "/marketing/whatsapp-campaigns/new",
    icon: MessageSquare,
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    badge: "$0.16/msg",
  },
  {
    name: "Email Campaign",
    description: "Design and send an email campaign",
    href: "/marketing/campaigns/new",
    icon: Mail,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    name: "Send Bulk Email",
    description: "Quick one-off email to customers",
    href: "/marketing/bulk-email",
    icon: Send,
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    name: "Manage Automations",
    description: "Set up automatic messages",
    href: "/marketing/automations",
    icon: Zap,
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

export default function MarketingOverviewClient({ stats, recentCampaigns, businessName }: Props) {
  const statusColors: Record<string, string> = {
    draft: "bg-stone-500/20 text-stone-400",
    scheduled: "bg-blue-500/20 text-blue-400",
    sending: "bg-amber-500/20 text-amber-400",
    sent: "bg-green-500/20 text-green-400",
    cancelled: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Marketing</h1>
            <p className="text-stone-400 text-sm">
              Engage your customers with email and WhatsApp campaigns
            </p>
          </div>
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
          <p className="text-2xl font-bold text-white">{stats.emailsSentThisMonth}</p>
          <p className="text-xs text-stone-500 mt-1">This month</p>
        </div>

        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              Open Rate
            </span>
            <Eye className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.openRate}%</p>
          <p className="text-xs text-stone-500 mt-1">
            {stats.openRate >= 20 ? "Good" : stats.openRate >= 10 ? "Average" : "Needs work"}
          </p>
        </div>

        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              WhatsApp Campaigns
            </span>
            <MessageSquare className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.whatsappCampaigns || 0}</p>
          <p className="text-xs text-stone-500 mt-1">Total sent</p>
        </div>

        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400 text-xs font-medium uppercase tracking-wide">
              Automations
            </span>
            <Zap className="w-4 h-4 text-stone-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.enabledAutomations}/{stats.totalAutomations}
          </p>
          <p className="text-xs text-stone-500 mt-1">Active</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className={`p-4 rounded-lg border ${action.color} hover:bg-opacity-20 transition-colors group relative`}
            >
              {action.badge && (
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                  {action.badge}
                </span>
              )}
              <action.icon className="w-6 h-6 mb-3" />
              <h3 className="font-semibold text-white mb-1">{action.name}</h3>
              <p className="text-xs text-stone-400">{action.description}</p>
              <ArrowRight className="w-4 h-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Campaigns</h2>
            <Link
              href="/marketing/campaigns"
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {recentCampaigns.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-8 h-8 text-stone-600 mx-auto mb-3" />
                <p className="text-stone-400 text-sm mb-3">No campaigns yet</p>
                <Link
                  href="/marketing/campaigns/new"
                  className="text-amber-400 text-sm hover:text-amber-300"
                >
                  Create your first campaign →
                </Link>
              </div>
            ) : (
              recentCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/marketing/campaigns/${campaign.id}`}
                  className="p-4 hover:bg-white/[0.02] transition-colors block"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-white truncate">{campaign.name}</h3>
                      <p className="text-xs text-stone-400 truncate mt-0.5">{campaign.subject}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusColors[campaign.status] || statusColors.draft}`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  {campaign.status === "sent" && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                      <span>{campaign.stats.sent} sent</span>
                      <span>{campaign.stats.opened} opened</span>
                      <span>{campaign.stats.clicked} clicked</span>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Marketing Tools */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="font-semibold text-white">Marketing Tools</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            <Link
              href="/marketing/whatsapp-campaigns"
              className="p-4 hover:bg-white/[0.02] transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white">WhatsApp Campaigns</h3>
                <p className="text-xs text-stone-400">
                  Send marketing messages • $0.16/message
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-500" />
            </Link>

            <Link
              href="/marketing/segments"
              className="p-4 hover:bg-white/[0.02] transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white">Customer Segments</h3>
                <p className="text-xs text-stone-400">
                  {stats.totalSegments} segments created
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-500" />
            </Link>

            <Link
              href="/marketing/templates"
              className="p-4 hover:bg-white/[0.02] transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white">Email Templates</h3>
                <p className="text-xs text-stone-400">
                  {stats.totalTemplates} templates available
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-500" />
            </Link>

            <Link
              href="/marketing/automations"
              className="p-4 hover:bg-white/[0.02] transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white">Automations</h3>
                <p className="text-xs text-stone-400">
                  {stats.enabledAutomations} of {stats.totalAutomations} active
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-8 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Marketing Tips</h3>
            <ul className="text-sm text-stone-300 space-y-1">
              <li>
                • <strong>WhatsApp messages</strong> have 98% open rates — much higher than email!
              </li>
              <li>
                • <strong>Birthday messages</strong> have 3x higher engagement — enable birthday automations!
              </li>
              <li>
                • Use <strong>customer segments</strong> to send targeted, relevant messages
              </li>
              <li>
                • <strong>Re-engagement</strong> campaigns can bring back 10% of lapsed customers
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
