"use client";

/**
 * Marketing Hub — Section 9 of Kaitlyn's 2026-05-02 redesign brief.
 *
 *   1. Page header (H1 + subtitle + "Create campaign" CTA)
 *   2. KPI strip (active / drafts / segments / scheduled / automations)
 *   3. Premium-feeling campaign-template strip
 *   4. Quick actions (CAMPAIGNS / OUTREACH / CLIENTELING)
 *   5. Recent campaigns panel — or empty state
 */

import Link from "next/link";
import {
  Plus,
  Megaphone,
  ListChecks,
  FileText,
  Mail,
  MessageSquare,
  Zap,
  Tag,
  Sparkles,
  Cake,
  PartyPopper,
  Wrench,
  Rocket,
  RefreshCw,
  ChevronRight,
  Send,
} from "lucide-react";
import {
  HubHeader,
  KpiCard,
  KpiStrip,
  QuickActionGroup,
  SectionPanel,
  HubEmptyState,
} from "@/components/hub/HubPrimitives";
import StatusBadge from "@/components/StatusBadge";

interface MarketingKpis {
  activeCampaigns: number;
  drafts: number;
  segments: number;
  scheduledMessages: number;
  enabledAutomations: number;
}

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface Props {
  kpis: MarketingKpis;
  recentCampaigns: Campaign[];
}

// Premium campaign templates — visual-first card strip per Section 9.
const TEMPLATES: Array<{
  title: string;
  description: string;
  href: string;
  icon: typeof Rocket;
}> = [
  {
    title: "New collection launch",
    description: "Announce a new piece or collection to your full client list.",
    href: "/marketing/campaigns/new?template=collection_launch",
    icon: Rocket,
  },
  {
    title: "Private viewing invite",
    description: "Invite VIPs to a private viewing or appointment-only preview.",
    href: "/marketing/campaigns/new?template=private_viewing",
    icon: Sparkles,
  },
  {
    title: "Birthday outreach",
    description: "A warm message and gesture for clients with birthdays this month.",
    href: "/marketing/campaigns/new?template=birthday",
    icon: Cake,
  },
  {
    title: "Anniversary check-in",
    description: "Reach out on the anniversary of a meaningful purchase.",
    href: "/marketing/campaigns/new?template=anniversary",
    icon: PartyPopper,
  },
  {
    title: "Repair pickup reminder",
    description: "Nudge clients to collect repaired pieces still in store.",
    href: "/marketing/campaigns/new?template=repair_pickup",
    icon: Wrench,
  },
  {
    title: "Re-engagement",
    description: "Win back clients who haven't engaged in 90+ days.",
    href: "/marketing/campaigns/new?template=re_engagement",
    icon: RefreshCw,
  },
];

export default function MarketingHubClient({ kpis, recentCampaigns }: Props) {
  const hasCampaigns = recentCampaigns.length > 0;

  return (
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Marketing"
        subtitle="Campaigns, segments, automations and clienteling outreach."
        ctas={[
          { label: "Create campaign", href: "/marketing/campaigns/new", variant: "primary", icon: Plus },
        ]}
      />

      <KpiStrip>
        <KpiCard
          label="Active campaigns"
          value={kpis.activeCampaigns}
          href="/marketing/campaigns"
          tone={kpis.activeCampaigns > 0 ? "success" : "neutral"}
        />
        <KpiCard
          label="Drafts"
          value={kpis.drafts}
          href="/marketing/campaigns"
          tone="neutral"
        />
        <KpiCard
          label="Segments"
          value={kpis.segments}
          href="/marketing/segments"
          tone="neutral"
        />
        <KpiCard
          label="Scheduled messages"
          value={kpis.scheduledMessages}
          href="/marketing/campaigns"
          tone="neutral"
        />
        <KpiCard
          label="Automation flows"
          value={kpis.enabledAutomations}
          href="/marketing/automations"
          tone={kpis.enabledAutomations > 0 ? "success" : "neutral"}
        />
      </KpiStrip>

      {/* Campaign template strip — premium-feeling cards */}
      <section>
        <h2 className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400 mb-3">
          Campaign templates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.title}
                href={t.href}
                className="group flex items-start gap-3 p-5 rounded-xl bg-nexpura-ivory-elevated border border-nexpura-taupe-100 hover:border-nexpura-taupe-200 hover:shadow-md hover:bg-nexpura-champagne/30 transition-all duration-200"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center text-nexpura-bronze">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal leading-tight">
                    {t.title}
                  </p>
                  <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-1 leading-relaxed">
                    {t.description}
                  </p>
                </div>
                <ChevronRight
                  className="flex-shrink-0 w-4 h-4 mt-0.5 text-nexpura-taupe-400 group-hover:translate-x-0.5 group-hover:text-nexpura-charcoal-700 transition-all duration-200"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick actions */}
      <div className="space-y-6">
        <QuickActionGroup
          label="Campaigns"
          actions={[
            {
              label: "Overview",
              description: "Performance and activity across every campaign.",
              href: "/marketing",
              icon: Megaphone,
            },
            {
              label: "Campaigns",
              description: "Email and WhatsApp campaigns with stats and history.",
              href: "/marketing/campaigns",
              icon: ListChecks,
            },
            {
              label: "Templates",
              description: "Saved email templates ready to send.",
              href: "/marketing/templates",
              icon: FileText,
            },
          ]}
        />

        <QuickActionGroup
          label="Outreach"
          actions={[
            {
              label: "Email outreach",
              description: "One-off bulk email to a segment or full list.",
              href: "/marketing/bulk-email",
              icon: Mail,
            },
            {
              label: "SMS outreach",
              description: "Direct SMS blasts to opted-in customers.",
              href: "/marketing/bulk-sms",
              icon: MessageSquare,
            },
            {
              label: "Automations",
              description: "Triggered flows for birthdays, milestones and lifecycle.",
              href: "/marketing/automations",
              icon: Zap,
            },
          ]}
        />

        <QuickActionGroup
          label="Clienteling"
          actions={[
            {
              label: "Segments",
              description: "Saved customer segments for targeted outreach.",
              href: "/marketing/segments",
              icon: Tag,
            },
            {
              label: "Clienteling",
              description: "Personal client communications and notes.",
              // /customers/communications doesn't exist — use the global
              // /communications module per brief's note.
              href: "/communications",
              icon: Sparkles,
            },
            {
              label: "Birthday campaign",
              description: "Reach clients with birthdays this month.",
              href: "/marketing/campaigns/new?template=birthday",
              icon: Cake,
            },
            {
              label: "Private event invite",
              description: "Invite VIPs to a private viewing or trunk show.",
              href: "/marketing/campaigns/new?template=private_viewing",
              icon: PartyPopper,
            },
          ]}
        />
      </div>

      {/* Recent campaigns panel */}
      {hasCampaigns ? (
        <SectionPanel
          title="Recent campaigns"
          description="Most recent email and WhatsApp campaigns."
          action={{ label: "View all", href: "/marketing/campaigns" }}
        >
          <ul className="divide-y divide-nexpura-taupe-100">
            {recentCampaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/marketing/campaigns/${c.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-nexpura-warm-tint transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal truncate">
                      {c.name}
                    </p>
                    {c.subject && (
                      <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5 truncate">
                        {c.subject}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : (
        <SectionPanel title="Campaigns">
          <HubEmptyState
            icon={Megaphone}
            title="No active campaigns"
            description="No active campaigns. Create a client campaign for launches, repairs, birthdays, anniversaries or private events."
            ctas={[
              { label: "Create campaign", href: "/marketing/campaigns/new", variant: "primary", icon: Plus },
              { label: "Browse templates", href: "/marketing/templates", variant: "secondary", icon: Send },
            ]}
          />
        </SectionPanel>
      )}
    </div>
  );
}
