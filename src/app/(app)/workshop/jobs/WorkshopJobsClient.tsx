"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardList,
  Hourglass,
  Inbox,
  PackageCheck,
  TimerReset,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";

// Public union types — the server page uses these to type its props
// without re-declaring the constants.
export const STATUS_FILTERS = [
  "active",
  "overdue",
  "ready-for-pickup",
  "completed",
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const TYPE_FILTERS = ["all", "repair", "bespoke", "appraisal"] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];

export interface UnifiedJob {
  id: string;
  type: "repair" | "bespoke" | "appraisal";
  jobNumber: string;
  customerName: string;
  itemSummary: string;
  // Underlying source-specific status/stage value. The table renders this
  // through StatusBadge so the pill colour reflects the workspace tone.
  stage: string;
  priority: string;
  dueDate: string | null; // ISO yyyy-mm-dd (or null for appraisals)
  assignedName: string | null;
  depositAmount: number | null;
  balanceDue: number | null;
  lastUpdate: string; // ISO timestamp
  href: string;
}

interface Props {
  jobs: UnifiedJob[];
  status: StatusFilter;
  typeFilter: TypeFilter;
  subFilter: string;
  todayIso: string;
}

// ── Status meta — drives the page heading + KPI strip + empty state ──
const STATUS_META: Record<
  StatusFilter,
  {
    label: string;
    description: string;
    accent: "ink" | "oxblood" | "emerald";
  }
> = {
  active: {
    label: "Active",
    description: "Repairs, bespoke commissions, and appraisals in flight.",
    accent: "ink",
  },
  overdue: {
    label: "Overdue",
    description: "Jobs past their due date — escalate to the customer.",
    accent: "oxblood",
  },
  "ready-for-pickup": {
    label: "Ready for pickup",
    description: "Finished workshop jobs awaiting customer collection.",
    accent: "emerald",
  },
  completed: {
    label: "Completed",
    description: "Closed workshop jobs.",
    accent: "ink",
  },
};

// ── Sub-filter chips per status — Section 4.2-4.5 of the brief ──
// Each chip is a (key, label) pair. The `all` chip clears `?filter=`.
const TYPE_CHIPS: Array<{ key: TypeFilter; label: string }> = [
  { key: "all", label: "All types" },
  { key: "repair", label: "Repairs" },
  { key: "bespoke", label: "Bespoke" },
  { key: "appraisal", label: "Appraisals" },
];

const SUB_CHIPS: Record<StatusFilter, Array<{ key: string; label: string }>> = {
  active: [
    { key: "all", label: "All" },
    { key: "in-progress", label: "In progress" },
    { key: "waiting", label: "Waiting" },
    { key: "due-soon", label: "Due soon" },
    { key: "high-value", label: "High value" },
  ],
  overdue: [
    { key: "all", label: "All overdue" },
    { key: "1-3", label: "1–3 days late" },
    { key: "4-7", label: "4–7 days late" },
    { key: "7-plus", label: "7+ days late" },
  ],
  "ready-for-pickup": [
    { key: "all", label: "All" },
    { key: "balance-owing", label: "Balance owing" },
    { key: "held-7-plus", label: "Held > 7 days" },
  ],
  completed: [{ key: "all", label: "All" }],
};

// ── Date helpers ─────────────────────────────────────────────────────
const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Component ────────────────────────────────────────────────────────
export default function WorkshopJobsClient({
  jobs,
  status,
  typeFilter,
  subFilter,
  todayIso,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ── Sub-filter (chip) application — keep server work cheap by doing
  // narrow, list-level filtering on the already-fetched stream. The
  // status/type filters drive the actual DB query; sub-filter just
  // refines the visible rows.
  const subFiltered = useMemo<UnifiedJob[]>(() => {
    if (subFilter === "all") return jobs;
    if (status === "active") {
      if (subFilter === "in-progress") {
        return jobs.filter((j) =>
          ["in_progress", "design", "design_review", "casting", "polish", "polishing", "setting"].includes(
            j.stage,
          ),
        );
      }
      if (subFilter === "waiting") {
        return jobs.filter((j) =>
          ["intake", "assessed", "quoted", "consultation", "enquiry", "draft"].includes(j.stage),
        );
      }
      if (subFilter === "due-soon") {
        // Within 3 days, not overdue.
        return jobs.filter((j) => {
          if (!j.dueDate) return false;
          const d = daysBetween(j.dueDate, todayIso);
          return d >= 0 && d <= 3;
        });
      }
      if (subFilter === "high-value") {
        return jobs.filter((j) => (j.balanceDue ?? 0) >= 1000);
      }
    } else if (status === "overdue") {
      const bucket = (j: UnifiedJob) => {
        if (!j.dueDate) return -1;
        return -daysBetween(j.dueDate, todayIso);
      };
      if (subFilter === "1-3") {
        return jobs.filter((j) => {
          const d = bucket(j);
          return d >= 1 && d <= 3;
        });
      }
      if (subFilter === "4-7") {
        return jobs.filter((j) => {
          const d = bucket(j);
          return d >= 4 && d <= 7;
        });
      }
      if (subFilter === "7-plus") {
        return jobs.filter((j) => bucket(j) > 7);
      }
    } else if (status === "ready-for-pickup") {
      if (subFilter === "balance-owing") {
        return jobs.filter((j) => (j.balanceDue ?? 0) > 0);
      }
      if (subFilter === "held-7-plus") {
        // Use lastUpdate as proxy for "moved-to-ready at" — not perfect
        // (we don't track ready_at) but consistent with how /repairs
        // surfaces stage age elsewhere.
        return jobs.filter((j) => {
          const updatedDay = j.lastUpdate.slice(0, 10);
          return -daysBetween(updatedDay, todayIso) > 7;
        });
      }
    }
    return jobs;
  }, [jobs, status, subFilter, todayIso]);

  // ── KPIs — one shared strip whose cells switch based on the active
  // status filter. The brief asks for distinct strips per status; this
  // is the consolidated version called out as acceptable in the task
  // description.
  const kpis = useMemo(() => computeKpis(subFiltered, status, todayIso), [
    subFiltered,
    status,
    todayIso,
  ]);

  // ── URL helpers — every chip click pushes to the same path with the
  // new search-params. Use `replace` so the back-button doesn't fill up
  // with chip toggles.
  const buildUrl = (next: { status?: string; type?: string; filter?: string }) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const merged: Record<string, string | undefined> = {
      status: status,
      type: typeFilter !== "all" ? typeFilter : undefined,
      filter: subFilter !== "all" ? subFilter : undefined,
      ...next,
    };
    params.delete("status");
    params.delete("type");
    params.delete("filter");
    if (merged.status) params.set("status", merged.status);
    if (merged.type) params.set("type", merged.type);
    if (merged.filter) params.set("filter", merged.filter);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname ?? "/workshop/jobs";
  };

  const navigate = (url: string) => {
    startTransition(() => router.replace(url));
  };

  const meta = STATUS_META[status];

  return (
    <div className={`space-y-6 ${isPending ? "opacity-80" : ""}`}>
      {/* Status tabs — top-level switch between the four broken-route filters. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-nexpura-taupe-100 pb-3">
        {STATUS_FILTERS.map((s) => {
          const active = s === status;
          return (
            <button
              key={s}
              type="button"
              onClick={() => navigate(buildUrl({ status: s, filter: undefined }))}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                active
                  ? "bg-nexpura-charcoal text-white"
                  : "text-nexpura-charcoal-500 hover:bg-nexpura-warm"
              }`}
            >
              {STATUS_META[s].label}
            </button>
          );
        })}
        <p className="ml-auto text-xs text-nexpura-charcoal-500">{meta.description}</p>
      </div>

      {/* KPI strip. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <k.icon
                className={`w-4 h-4 ${
                  k.accent === "oxblood"
                    ? "text-nexpura-oxblood"
                    : k.accent === "emerald"
                      ? "text-nexpura-emerald-deep"
                      : "text-nexpura-taupe-400"
                }`}
              />
              <p className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                {k.label}
              </p>
            </div>
            <p
              className={`text-2xl font-semibold ${
                k.accent === "oxblood"
                  ? "text-nexpura-oxblood"
                  : k.accent === "emerald"
                    ? "text-nexpura-emerald-deep"
                    : "text-nexpura-charcoal-700"
              }`}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar — type chips + status-specific sub-chips, horizontal scroll. */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TYPE_CHIPS.map((c) => {
            const active = c.key === typeFilter;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  navigate(
                    buildUrl({
                      type: c.key === "all" ? undefined : c.key,
                    }),
                  )
                }
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
                  active
                    ? "bg-nexpura-charcoal text-white border-nexpura-charcoal"
                    : "bg-nexpura-ivory-elevated border-nexpura-taupe-100 text-nexpura-charcoal-500 hover:border-nexpura-taupe-200"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {SUB_CHIPS[status].map((c) => {
            const active = c.key === subFilter || (c.key === "all" && subFilter === "all");
            return (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  navigate(
                    buildUrl({
                      filter: c.key === "all" ? undefined : c.key,
                    }),
                  )
                }
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
                  active
                    ? "bg-nexpura-charcoal text-white border-nexpura-charcoal"
                    : "bg-nexpura-ivory-elevated border-nexpura-taupe-100 text-nexpura-charcoal-500 hover:border-nexpura-taupe-200"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table or empty state. */}
      {subFiltered.length === 0 ? (
        renderEmpty(status)
      ) : (
        <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-nexpura-taupe-100">
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Job #
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Customer
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Item
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Type
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Status
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Priority
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Due date
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Assigned
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Deposit / Balance
                </TableHead>
                <TableHead className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Last update
                </TableHead>
                <TableHead className="text-right font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subFiltered.map((j) => (
                <Row key={`${j.type}-${j.id}`} job={j} status={status} todayIso={todayIso} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── KPI computation ──────────────────────────────────────────────────
type Kpi = {
  label: string;
  value: string;
  accent: "ink" | "oxblood" | "emerald";
  icon: typeof Clock;
};

function computeKpis(
  jobs: UnifiedJob[],
  status: StatusFilter,
  todayIso: string,
): Kpi[] {
  const total = jobs.length;
  if (status === "active") {
    const inProgress = jobs.filter((j) =>
      ["in_progress", "design", "casting", "polishing", "setting"].includes(j.stage),
    ).length;
    const waiting = jobs.filter((j) =>
      ["intake", "assessed", "quoted", "consultation", "enquiry", "draft"].includes(j.stage),
    ).length;
    const dueSoon = jobs.filter((j) => {
      if (!j.dueDate) return false;
      const d = daysBetween(j.dueDate, todayIso);
      return d >= 0 && d <= 3;
    }).length;
    const overdue = jobs.filter(
      (j) => j.dueDate != null && j.dueDate < todayIso,
    ).length;
    return [
      { label: "Active", value: String(total), accent: "ink", icon: ClipboardList },
      { label: "In progress", value: String(inProgress), accent: "ink", icon: Clock },
      { label: "Waiting", value: String(waiting), accent: "ink", icon: Hourglass },
      { label: "Due soon", value: String(dueSoon), accent: "ink", icon: TimerReset },
      { label: "Overdue", value: String(overdue), accent: "oxblood", icon: AlertTriangle },
    ];
  }
  if (status === "overdue") {
    const totalDays = jobs.reduce((acc, j) => {
      if (!j.dueDate) return acc;
      return acc + Math.max(0, -daysBetween(j.dueDate, todayIso));
    }, 0);
    const avg = total > 0 ? Math.round(totalDays / total) : 0;
    const highPriority = jobs.filter(
      (j) => j.priority === "urgent" || j.priority === "high",
    ).length;
    const noContact = jobs.filter((j) => {
      // "Customer updates needed" — proxy as: no `lastUpdate` change in
      // the last 3 days. Schema doesn't track explicit customer-contact
      // events here so this is the best signal available without a
      // dedicated audit join.
      const day = j.lastUpdate.slice(0, 10);
      return -daysBetween(day, todayIso) >= 3;
    }).length;
    const repairs = jobs.filter((j) => j.type === "repair").length;
    return [
      { label: "Total overdue", value: String(total), accent: "oxblood", icon: AlertTriangle },
      { label: "Avg days late", value: String(avg), accent: "oxblood", icon: TimerReset },
      { label: "High priority", value: String(highPriority), accent: "oxblood", icon: AlertTriangle },
      { label: "Updates needed", value: String(noContact), accent: "oxblood", icon: Inbox },
      { label: "Repairs", value: String(repairs), accent: "oxblood", icon: ClipboardList },
    ];
  }
  if (status === "ready-for-pickup") {
    const balanceOwing = jobs.filter((j) => (j.balanceDue ?? 0) > 0).length;
    const noBalance = total - balanceOwing;
    const held7 = jobs.filter((j) => {
      const day = j.lastUpdate.slice(0, 10);
      return -daysBetween(day, todayIso) > 7;
    }).length;
    const repairs = jobs.filter((j) => j.type === "repair").length;
    const bespoke = jobs.filter((j) => j.type === "bespoke").length;
    return [
      { label: "Ready", value: String(total), accent: "emerald", icon: PackageCheck },
      { label: "Balance owing", value: String(balanceOwing), accent: "ink", icon: Inbox },
      { label: "Paid in full", value: String(noBalance), accent: "emerald", icon: CheckCircle },
      { label: "Held > 7 days", value: String(held7), accent: "oxblood", icon: AlertTriangle },
      { label: "Repairs / Bespoke", value: `${repairs} / ${bespoke}`, accent: "ink", icon: ClipboardList },
    ];
  }
  // completed
  const repairs = jobs.filter((j) => j.type === "repair").length;
  const bespoke = jobs.filter((j) => j.type === "bespoke").length;
  const appraisals = jobs.filter((j) => j.type === "appraisal").length;
  const last7 = jobs.filter((j) => {
    const day = j.lastUpdate.slice(0, 10);
    return -daysBetween(day, todayIso) <= 7;
  }).length;
  return [
    { label: "Completed", value: String(total), accent: "ink", icon: CheckCircle },
    { label: "Last 7 days", value: String(last7), accent: "ink", icon: Clock },
    { label: "Repairs", value: String(repairs), accent: "ink", icon: ClipboardList },
    { label: "Bespoke", value: String(bespoke), accent: "ink", icon: ClipboardList },
    { label: "Appraisals", value: String(appraisals), accent: "ink", icon: ClipboardList },
  ];
}

// ── Row ──────────────────────────────────────────────────────────────
function Row({
  job,
  status,
  todayIso,
}: {
  job: UnifiedJob;
  status: StatusFilter;
  todayIso: string;
}) {
  const overdue =
    job.dueDate != null &&
    job.dueDate < todayIso &&
    status !== "ready-for-pickup" &&
    status !== "completed";
  const dueLabel = job.dueDate
    ? DATE_FMT.format(new Date(job.dueDate + "T00:00:00Z"))
    : "—";
  const lastLabel = DATETIME_FMT.format(new Date(job.lastUpdate));
  const stageTone =
    status === "overdue"
      ? "overdue"
      : status === "ready-for-pickup"
        ? "ready"
        : status === "completed"
          ? "neutral"
          : "auto";

  return (
    <TableRow className="border-nexpura-taupe-100/60 hover:bg-nexpura-warm/40">
      <TableCell>
        <Link
          href={job.href}
          className="text-sm font-medium text-nexpura-charcoal-700 hover:text-nexpura-charcoal"
        >
          {job.jobNumber}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-nexpura-charcoal-700">{job.customerName}</TableCell>
      <TableCell className="text-sm text-nexpura-charcoal-700 max-w-[240px] truncate">
        {job.itemSummary}
      </TableCell>
      <TableCell className="text-xs uppercase tracking-wider text-nexpura-taupe-400">
        {job.type}
      </TableCell>
      <TableCell>
        <StatusBadge status={job.stage} tone={stageTone} />
      </TableCell>
      <TableCell>
        {job.priority === "urgent" || job.priority === "high" ? (
          <StatusBadge status={job.priority} tone="overdue" />
        ) : (
          <span className="text-xs text-nexpura-charcoal-500 capitalize">{job.priority}</span>
        )}
      </TableCell>
      <TableCell
        className={`text-sm ${
          overdue ? "text-nexpura-oxblood font-medium" : "text-nexpura-charcoal-700"
        }`}
      >
        {dueLabel}
      </TableCell>
      <TableCell className="text-sm text-nexpura-charcoal-700">
        {job.assignedName ?? <span className="text-nexpura-taupe-400">—</span>}
      </TableCell>
      <TableCell className="text-sm text-nexpura-charcoal-700 whitespace-nowrap">
        {formatCurrency(job.depositAmount)}{" "}
        <span className="text-nexpura-taupe-400">/</span>{" "}
        <span
          className={
            (job.balanceDue ?? 0) > 0 ? "text-nexpura-oxblood" : "text-nexpura-emerald-deep"
          }
        >
          {formatCurrency(job.balanceDue)}
        </span>
      </TableCell>
      <TableCell className="text-xs text-nexpura-taupe-400 whitespace-nowrap">
        {lastLabel}
      </TableCell>
      <TableCell className="text-right">
        <Link
          href={job.href}
          className="text-xs font-medium text-nexpura-charcoal-700 hover:text-nexpura-charcoal hover:underline"
        >
          Open
        </Link>
      </TableCell>
    </TableRow>
  );
}

// ── Empty states — Section 4.2-4.5 of the brief ─────────────────────
function renderEmpty(status: StatusFilter) {
  if (status === "active") {
    return (
      <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm">
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title="No active jobs"
          description="Start a repair, bespoke commission, or appraisal to see it here."
          action={{ label: "Create job", href: "/repairs/new" }}
        />
      </div>
    );
  }
  if (status === "overdue") {
    return (
      <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-nexpura-emerald-bg rounded-xl flex items-center justify-center mb-4 text-nexpura-emerald-deep">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-stone-700 mb-1">
            Everything is on schedule
          </h3>
          <p className="text-sm text-stone-500 max-w-sm leading-relaxed">
            No overdue workshop jobs right now.
          </p>
          <div className="mt-5">
            <Link
              href="/workshop/jobs?status=active"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700 transition-colors"
            >
              View active jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (status === "ready-for-pickup") {
    return (
      <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm">
        <EmptyState
          icon={<PackageCheck className="w-6 h-6" />}
          title="No items ready for pickup"
          description="Completed workshop jobs will appear here once they're ready for the customer."
        />
      </div>
    );
  }
  return (
    <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm">
      <EmptyState
        icon={<CheckCircle className="w-6 h-6" />}
        title="No completed jobs yet"
        description="Workshop jobs marked collected, delivered, or issued will be listed here."
      />
    </div>
  );
}
