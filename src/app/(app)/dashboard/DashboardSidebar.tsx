"use client";

// Directive kept deliberately: DashboardSidebar is imported (via
// next/dynamic) from the client component DashboardClient. React's RSC
// model forbids importing a server component into a client module, so this
// file ships in the client bundle. The "Send feedback" footer also uses an
// onClick handler, so the directive is no longer purely structural.

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Hammer,
  Inbox,
  MessageSquare,
  ShoppingBag,
  Wrench,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type OverdueRepair = {
  id: string;
  repairNumber: string;
  item: string;
  customer: string | null;
  daysOverdue: number;
  locationName?: string;
};

type ReadyItem = {
  id: string;
  number: string;
  label: string;
  customer: string | null;
  type: "repair" | "bespoke";
  locationName?: string;
};

type MyTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
};

type RecentSale = {
  id: string;
  saleNumber: string;
  customer: string | null;
};

type RecentRepair = {
  id: string;
  repairNumber: string;
  customer: string | null;
};

type LowStockItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
};

type ActivityItem = {
  id: string;
  title: string;
  stage: string;
  customerName: string | null;
  updatedAt: string;
  type: "job" | "repair";
  href: string;
};

interface DashboardSidebarProps {
  bp: string;
  isStatsLoading: boolean;
  myTasks: MyTask[];
  readyForPickup: ReadyItem[];
  overdueRepairs: OverdueRepair[];
  recentSales: RecentSale[];
  recentRepairsList: RecentRepair[];
  recentActivity: ActivityItem[];
  lowStockItems: LowStockItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function dueTimeLabel(due: string | null): string {
  if (!due) return "";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "";
  // Tasks due today — show time if the timestamp encodes one, otherwise
  // just "today". Date-only ISO strings parse with midnight, which we
  // treat as "any time today".
  const hasTime = /T\d/.test(due);
  if (!hasTime) return "today";
  return d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Section primitives ────────────────────────────────────────────────────

function Section({
  title,
  children,
  count,
  href,
}: {
  title: string;
  children: React.ReactNode;
  count?: number;
  href?: string;
}) {
  const headerInner = (
    <div className="flex items-center justify-between">
      <h3 className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400">
        {title}
      </h3>
      {typeof count === "number" && count > 0 && (
        <span className="font-sans text-[11px] tabular-nums text-nexpura-charcoal-500">
          {count}
        </span>
      )}
    </div>
  );
  return (
    <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-nexpura-taupe-100">
        {href ? (
          <Link href={href} className="block hover:opacity-80 transition-opacity">
            {headerInner}
          </Link>
        ) : (
          headerInner
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[13px] text-nexpura-charcoal-500">{children}</p>
  );
}

// Initial avatar — owner unknown at this layer, so we render a quiet ring
// with the assignee initial when we can derive one. Keeps the visual rhythm
// the brief asks for without inventing data.
function InitialAvatar({ label }: { label: string }) {
  const initial = label?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-nexpura-taupe-100 text-nexpura-charcoal-700 font-sans text-[10px] font-semibold">
      {initial}
    </span>
  );
}

// ─── Sub-sections ──────────────────────────────────────────────────────────

function TasksDue({
  tasks,
  bp,
  isLoading,
}: {
  tasks: MyTask[];
  bp: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (tasks.length === 0) {
    return <EmptyLine>No tasks due today.</EmptyLine>;
  }
  return (
    <ul className="space-y-1">
      {tasks.slice(0, 4).map((t) => (
        <li key={t.id}>
          <Link
            href={`${bp}/tasks`}
            className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-white transition-colors duration-150"
          >
            <span
              className="flex-shrink-0 w-3.5 h-3.5 rounded border border-nexpura-taupe-200 bg-white"
              aria-hidden
            />
            <span className="flex-1 min-w-0 font-sans text-[13px] text-nexpura-charcoal-700 truncate">
              {t.title}
            </span>
            <InitialAvatar label={t.title} />
            <span className="flex-shrink-0 font-sans text-[11px] tabular-nums text-nexpura-charcoal-500">
              {dueTimeLabel(t.due_date)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReadyForPickupSection({
  items,
  bp,
  isLoading,
}: {
  items: ReadyItem[];
  bp: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyLine>Nothing ready yet.</EmptyLine>;
  }
  return (
    <ul className="space-y-1">
      {items.slice(0, 4).map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <Link
            href={`${bp}/${item.type === "repair" ? "repairs" : "bespoke"}/${item.id}`}
            className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-white transition-colors duration-150"
          >
            <CheckCircle2
              className="w-3.5 h-3.5 flex-shrink-0 text-nexpura-emerald-deep"
              aria-hidden
            />
            <span className="flex-1 min-w-0">
              <span className="block font-sans text-[13px] text-nexpura-charcoal-700 truncate">
                {item.label}
              </span>
              {item.customer && (
                <span className="block font-sans text-[11px] text-nexpura-charcoal-500 truncate">
                  {item.customer}
                </span>
              )}
            </span>
            <span className="flex-shrink-0 font-sans text-[11px] font-mono text-nexpura-taupe-400 tabular-nums">
              #{item.number}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentActivitySection({
  activity,
  recentSales,
  bp,
  isLoading,
}: {
  activity: ActivityItem[];
  recentSales: RecentSale[];
  bp: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  // Merge the precomputed activity feed with the recent-sales slice into one
  // ordered list. Sales rows don't carry an updated_at, so they're appended
  // at the head when present (most recent first by sale_number ordering on
  // the server). The brief wants "last 5 events" — we cap there.
  type Row = {
    key: string;
    icon: React.ReactNode;
    title: string;
    sub?: string;
    when?: string;
    href: string;
  };
  const rows: Row[] = [];

  for (const s of recentSales.slice(0, 2)) {
    rows.push({
      key: `sale-${s.id}`,
      icon: <ShoppingBag className="w-3.5 h-3.5 text-nexpura-bronze" aria-hidden />,
      title: `Sale to ${s.customer ?? "walk-in"}`,
      sub: `#${s.saleNumber}`,
      href: `${bp}/sales/${s.id}`,
    });
  }
  for (const a of activity.slice(0, 5)) {
    rows.push({
      key: `act-${a.type}-${a.id}`,
      icon:
        a.type === "job" ? (
          <Hammer className="w-3.5 h-3.5 text-nexpura-bronze" aria-hidden />
        ) : (
          <Wrench className="w-3.5 h-3.5 text-nexpura-bronze" aria-hidden />
        ),
      title: a.title,
      sub: a.customerName ?? undefined,
      when: relativeTime(a.updatedAt),
      href: `${bp}${a.href}`,
    });
  }

  const trimmed = rows.slice(0, 5);
  if (trimmed.length === 0) {
    return <EmptyLine>No recent activity yet.</EmptyLine>;
  }

  return (
    <ul className="space-y-1">
      {trimmed.map((r) => (
        <li key={r.key}>
          <Link
            href={r.href}
            className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-white transition-colors duration-150"
          >
            <span className="flex-shrink-0">{r.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-sans text-[13px] text-nexpura-charcoal-700 truncate">
                {r.title}
              </span>
              {r.sub && (
                <span className="block font-sans text-[11px] text-nexpura-charcoal-500 truncate">
                  {r.sub}
                </span>
              )}
            </span>
            {r.when && (
              <span className="flex-shrink-0 font-sans text-[11px] tabular-nums text-nexpura-taupe-400">
                {r.when}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AlertsSection({
  overdueRepairs,
  lowStockItems,
  bp,
}: {
  overdueRepairs: OverdueRepair[];
  lowStockItems: LowStockItem[];
  bp: string;
}) {
  // Brief: HIDE the alerts section entirely when there are zero alerts.
  const criticalLowStock = lowStockItems.filter((i) => i.quantity === 0);
  const alerts: Array<{ id: string; label: string; href: string; tone: "danger" | "warn" }> = [];
  for (const r of overdueRepairs.slice(0, 3)) {
    alerts.push({
      id: `repair-${r.id}`,
      label: `${r.item} · ${r.daysOverdue}d overdue`,
      href: `${bp}/repairs/${r.id}`,
      tone: "danger",
    });
  }
  for (const s of criticalLowStock.slice(0, 3)) {
    alerts.push({
      id: `stock-${s.id}`,
      label: `${s.name} out of stock`,
      href: `${bp}/inventory`,
      tone: "danger",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Section title="Alerts" count={alerts.length}>
      <ul className="space-y-1">
        {alerts.map((a) => (
          <li key={a.id}>
            <Link
              href={a.href}
              className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-white transition-colors duration-150"
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  a.tone === "danger" ? "text-nexpura-oxblood" : "text-nexpura-amber-muted"
                }`}
                aria-hidden
              />
              <span className="flex-1 min-w-0 font-sans text-[13px] text-nexpura-charcoal-700 truncate">
                {a.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

/**
 * Right sidebar — "Today" panel per Section 3.4 of Kaitlyn's brief.
 *
 * 320px sticky on xl+, hidden below xl (the module grid + KPI strip stay
 * usable on tablet/mobile without it).
 *
 * The Copilot "Next best action" card is intentionally omitted — the
 * brief defers it until Copilot is enabled.
 */
export default function DashboardSidebar({
  bp,
  isStatsLoading,
  myTasks,
  readyForPickup,
  overdueRepairs,
  recentSales,
  recentActivity,
  lowStockItems,
}: DashboardSidebarProps) {
  return (
    <aside className="hidden xl:flex flex-col gap-3 w-[320px] flex-shrink-0 sticky top-[88px]">
      <Section title="Tasks due today" count={myTasks.length} href={`${bp}/tasks`}>
        <TasksDue tasks={myTasks} bp={bp} isLoading={isStatsLoading} />
      </Section>

      <Section
        title="Ready for pickup"
        count={readyForPickup.length}
        href={`${bp}/workshop?status=ready-for-pickup`}
      >
        <ReadyForPickupSection items={readyForPickup} bp={bp} isLoading={isStatsLoading} />
      </Section>

      <Section title="Recent activity">
        <RecentActivitySection
          activity={recentActivity}
          recentSales={recentSales}
          bp={bp}
          isLoading={isStatsLoading}
        />
      </Section>

      <AlertsSection
        overdueRepairs={overdueRepairs}
        lowStockItems={lowStockItems}
        bp={bp}
      />

      {/* Footer feedback affordance */}
      <div className="flex justify-end pt-1">
        <Link
          href={`${bp}/support`}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-sans text-[12px] text-nexpura-taupe-400 hover:text-nexpura-charcoal-700 hover:bg-nexpura-ivory-elevated transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden />
          Send feedback
        </Link>
      </div>
    </aside>
  );
}

// Defensive: keep the Inbox import live in case future variants want to
// surface an empty state with it. The cost of one unused import is nil.
void Inbox;
