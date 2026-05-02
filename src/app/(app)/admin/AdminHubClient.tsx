"use client";

/**
 * Tenant Admin Hub — Section 11 of Kaitlyn's 2026-05-02 redesign brief.
 *
 *   1. Page header (H1 + subtitle, no primary CTA — admin is consumed not created)
 *   2. Tasks & Admin panel (5 mini KPIs + quick complete on top 3 tasks)
 *   3. Quick actions (WORKSPACE / TEAM / OPERATIONS)
 *   4. AI Copilot card — subtle, no gradients
 */

import Link from "next/link";
import {
  Settings,
  CreditCard,
  Bell,
  ScrollText,
  Users,
  AtSign,
  Plug,
  ListChecks,
  Plus,
  LifeBuoy,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  HubHeader,
  KpiCard,
  QuickActionGroup,
  SectionPanel,
} from "@/components/hub/HubPrimitives";

interface TopTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
}

interface AdminPanel {
  tasksDueCount: number;
  topTasks: TopTask[];
  pendingSetup: number;
  teamInvites: number;
  billingStatus: string;
  supportRequests: number;
}

interface Props {
  panel: AdminPanel;
}

function relativeDue(iso: string | null): string {
  if (!iso) return "No due date";
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return "No due date";
  const diff = due - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

export default function AdminHubClient({ panel }: Props) {
  const { tasksDueCount, topTasks, pendingSetup, teamInvites, billingStatus, supportRequests } = panel;

  return (
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Admin"
        subtitle="Manage workspace settings, billing, team, roles and operational tasks."
      />

      {/* Tasks & Admin panel */}
      <SectionPanel
        title="Tasks & Admin"
        description="Day-to-day operational signals across the workspace."
      >
        <div className="p-5 space-y-5">
          {/* Mini KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Tasks due"
              value={tasksDueCount}
              href="/tasks"
              tone={tasksDueCount > 0 ? "warn" : "neutral"}
            />
            <KpiCard
              label="Pending setup"
              value={pendingSetup}
              href="/settings/general"
              tone="neutral"
              hint={pendingSetup === 0 ? "Configured" : undefined}
            />
            <KpiCard
              label="Team invites"
              value={teamInvites}
              href="/settings/team"
              tone={teamInvites > 0 ? "warn" : "neutral"}
            />
            <KpiCard
              label="Billing"
              value={billingStatus}
              href="/billing"
              tone={
                billingStatus === "Past due" || billingStatus === "Canceled"
                  ? "danger"
                  : billingStatus === "Active"
                    ? "success"
                    : "neutral"
              }
            />
            <KpiCard
              label="Support requests"
              value={supportRequests}
              href="/support"
              tone={supportRequests > 0 ? "warn" : "neutral"}
            />
          </div>

          {/* Top 3 tasks (quick complete handled on /tasks page itself) */}
          {topTasks.length > 0 && (
            <div>
              <h3 className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400 mb-3">
                Up next
              </h3>
              <ul className="divide-y divide-nexpura-taupe-100 border border-nexpura-taupe-100 rounded-xl bg-nexpura-ivory">
                {topTasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-nexpura-warm-tint transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[14px] font-medium text-nexpura-charcoal truncate">
                          {task.title}
                        </p>
                        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5">
                          {relativeDue(task.due_date)}
                        </p>
                      </div>
                      <ArrowRight
                        className="flex-shrink-0 w-4 h-4 text-nexpura-taupe-400"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionPanel>

      {/* Quick actions */}
      <div className="space-y-6">
        <QuickActionGroup
          label="Workspace"
          actions={[
            {
              label: "Settings",
              description: "General workspace preferences and business details.",
              href: "/settings",
              icon: Settings,
            },
            {
              label: "Billing",
              description: "Plan, invoices and payment method.",
              href: "/billing",
              icon: CreditCard,
            },
            {
              label: "Notifications",
              description: "Email, SMS and WhatsApp delivery preferences.",
              href: "/settings/notifications",
              icon: Bell,
            },
            {
              label: "Activity log",
              description: "Audit trail of changes across the workspace.",
              href: "/settings/activity",
              icon: ScrollText,
            },
          ]}
        />

        <QuickActionGroup
          label="Team"
          actions={[
            {
              label: "Team & Roles",
              description: "Invite teammates and manage role-based permissions.",
              href: "/settings/team",
              icon: Users,
            },
            {
              label: "Email Domain",
              description: "Verify a sending domain for marketing and transactional email.",
              href: "/settings/email-domain",
              icon: AtSign,
            },
            {
              label: "Integrations",
              description: "Connect Shopify, Mailchimp, Google Calendar and more.",
              href: "/settings/integrations",
              icon: Plug,
            },
          ]}
        />

        <QuickActionGroup
          label="Operations"
          actions={[
            {
              label: "Tasks",
              description: "Team task board and assignments.",
              href: "/tasks",
              icon: ListChecks,
            },
            {
              label: "New Task",
              description: "Assign a one-off task to a teammate.",
              href: "/tasks/new",
              icon: Plus,
            },
            {
              label: "AI Copilot",
              description: "Conversational assistant for the workspace.",
              href: "/copilot",
              icon: Sparkles,
            },
            {
              label: "Support",
              description: "Contact Nexpura support and view open requests.",
              href: "/support",
              icon: LifeBuoy,
            },
          ]}
        />
      </div>

      {/* AI Copilot card — subtle, no gradients/animation */}
      <section className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center">
            <Sparkles className="w-[18px] h-[18px] text-nexpura-taupe-400" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-[16px] font-semibold text-nexpura-charcoal leading-tight">
              AI Copilot
            </h3>
            <p className="font-sans text-[13px] text-nexpura-charcoal-500 mt-1 leading-relaxed">
              Ask the workspace anything — find a customer, summarise a job, draft a follow-up.
            </p>
          </div>
          <Link
            href="/copilot"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700 transition-colors"
          >
            Open Copilot
          </Link>
        </div>
      </section>
    </div>
  );
}
