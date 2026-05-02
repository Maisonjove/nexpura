"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Globe,
  Layers,
  MapPin,
  Megaphone,
  PackageOpen,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { DashboardClock } from "./DashboardClock";
import { useLocation } from "@/contexts/LocationContext";
import { Card } from "@/components/ui/card";

/**
 * Dashboard — "Workspace Command Centre".
 *
 * Layered on top of the existing data hooks (DashboardWrapper + actions.ts +
 * _stats-hydrate). The data flow from the server actions is unchanged; only
 * this presentation layer was rebuilt to Kaitlyn's 2026-05-02 brief
 * (Section 3). The right sidebar is its own dynamic chunk; the KPI chips,
 * page header, clock and module command grid are rendered inline.
 *
 * Token vocabulary lives under the `nexpura.*` Tailwind namespace
 * (`tailwind.config.ts`). No raw hex outside the config. No amber CTAs —
 * primary action colour is charcoal.
 */

const DashboardSidebar = dynamic(() => import("./DashboardSidebar"), {
  ssr: true,
  loading: () => (
    <aside className="hidden xl:flex flex-col gap-4 w-[320px] flex-shrink-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl p-5 animate-pulse"
        >
          <div className="h-3 w-24 bg-stone-100 rounded mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-stone-100 rounded" />
            <div className="h-3 w-5/6 bg-stone-100 rounded" />
            <div className="h-3 w-2/3 bg-stone-100 rounded" />
          </div>
        </div>
      ))}
    </aside>
  ),
});

// ─── Types (mirrors the data flowing through DashboardWrapper) ──────────────

type ActivityItem = {
  id: string;
  title: string;
  stage: string;
  customerName: string | null;
  updatedAt: string;
  type: "job" | "repair";
  href: string;
};

type ActiveRepair = {
  id: string;
  customer: string | null;
  item: string;
  stage: string;
  due_date: string | null;
};

type ActiveBespokeJob = {
  id: string;
  customer: string | null;
  title: string;
  stage: string;
  due_date: string | null;
};

type LowStockItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
};

type OverdueRepair = {
  id: string;
  repairNumber: string;
  item: string;
  customer: string | null;
  daysOverdue: number;
};

type ReadyItem = {
  id: string;
  number: string;
  label: string;
  customer: string | null;
  type: "repair" | "bespoke";
};

type TeamTaskSummary = {
  assigneeId: string;
  assigneeName: string;
  taskCount: number;
  overdueCount: number;
};

interface DashboardClientProps {
  basePath?: string;
  readOnly?: boolean;
  firstName: string;
  tenantName: string | null;
  businessType: string | null;
  salesThisMonthRevenue: number;
  salesThisMonthCount: number;
  activeRepairsCount: number;
  activeJobsCount: number;
  totalOutstanding: number;
  overdueInvoiceCount: number;
  lowStockItems: LowStockItem[];
  overdueRepairs: OverdueRepair[];
  readyForPickup: ReadyItem[];
  recentActivity: ActivityItem[];
  myTasks: {
    id: string;
    title: string;
    priority: string;
    status: string;
    due_date: string | null;
  }[];
  teamTaskSummary: TeamTaskSummary[];
  isManager: boolean;
  activeRepairs: ActiveRepair[];
  activeBespokeJobs: ActiveBespokeJob[];
  currency: string;
  recentSales: { id: string; saleNumber: string; customer: string | null }[];
  recentRepairsList: { id: string; repairNumber: string; customer: string | null }[];
  revenueSparkline?: { value: number }[];
  salesCountSparkline?: { value: number }[];
  repairsSparkline?: { value: number }[];
  customersSparkline?: { value: number }[];
  salesBarData?: { day: string; sales: number; revenue: number }[];
  repairStageData?: { name: string; value: number }[];
  isStatsLoading?: boolean;
}

// ─── Header ─────────────────────────────────────────────────────────────────

function PageHeader({ tenantName }: { tenantName: string | null }) {
  const { currentLocation, hasMultipleLocations, isLoading } = useLocation();
  const tenantLabel = tenantName?.trim() || "Workspace";

  // Identity for the H1: when a single location is selected, that location
  // becomes the heading; otherwise the workspace identity rules.
  const showLocationView =
    !isLoading && hasMultipleLocations && currentLocation;

  const heading = showLocationView ? currentLocation!.name : "Nexpura Workspace";

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        {showLocationView && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-nexpura-amber-bg border border-nexpura-taupe-100 text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-amber-muted mb-2">
            <MapPin size={12} />
            Location view
          </div>
        )}
        {!showLocationView && hasMultipleLocations && !isLoading && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-nexpura-ivory-elevated border border-nexpura-taupe-100 text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-charcoal-500 mb-2">
            <Layers size={12} />
            All locations
          </div>
        )}
        <h1 className="font-serif text-[32px] md:text-[26px] font-medium tracking-[-0.01em] text-nexpura-charcoal leading-tight">
          {heading}
        </h1>
        <p className="font-sans text-[13px] text-nexpura-charcoal-500 mt-1.5 leading-relaxed">
          {showLocationView ? (
            <>
              <span className="font-medium text-nexpura-charcoal-700">{tenantLabel}</span>
              <span className="mx-1.5 text-nexpura-taupe-200">·</span>
              Activity scoped to this location
            </>
          ) : (
            <>Today&rsquo;s overview across sales, inventory, workshop, clients and finance.</>
          )}
        </p>
      </div>
      <DashboardClock />
    </div>
  );
}

// ─── KPI strip ──────────────────────────────────────────────────────────────

type KpiStyle = "neutral" | "warn" | "danger" | "success";

function KpiChip({
  label,
  count,
  href,
  style,
}: {
  label: string;
  count: number;
  href: string;
  style: KpiStyle;
}) {
  const isZero = count === 0;
  const showStatusIcon = !isZero;

  // Number colour: when zero, taupe-400 (muted) per brief. When non-zero,
  // the chip's intent colour.
  const numberColor = isZero
    ? "text-nexpura-taupe-400"
    : style === "danger"
      ? "text-nexpura-oxblood"
      : style === "warn"
        ? "text-nexpura-amber-muted"
        : style === "success"
          ? "text-nexpura-emerald-deep"
          : "text-nexpura-charcoal-700";

  // Border tint hints at urgency without shouting. Hover state is shared
  // (taupe-200) so the strip feels uniformly interactive.
  const borderColor = isZero
    ? "border-nexpura-taupe-100"
    : style === "danger"
      ? "border-nexpura-oxblood-bg"
      : style === "warn"
        ? "border-nexpura-amber-bg"
        : style === "success"
          ? "border-nexpura-emerald-bg"
          : "border-nexpura-taupe-100";

  return (
    <Link
      href={href}
      title={isZero ? "All clear." : undefined}
      className={`group flex items-center justify-between gap-3 bg-nexpura-ivory-elevated rounded-xl px-4 py-3.5 border ${borderColor} hover:border-nexpura-taupe-200 hover:shadow-md transition-all duration-200`}
    >
      <div className="min-w-0">
        <p className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400 truncate">
          {label}
        </p>
        <p
          className={`font-sans text-[24px] font-medium tracking-[-0.01em] tabular-nums leading-none mt-1.5 ${numberColor}`}
        >
          {count}
        </p>
      </div>
      <div className="flex-shrink-0">
        {isZero ? (
          <CheckCircle className="w-5 h-5 text-nexpura-emerald-deep" aria-hidden />
        ) : showStatusIcon && style === "danger" ? (
          <AlertTriangle className="w-5 h-5 text-nexpura-oxblood" aria-hidden />
        ) : showStatusIcon && style === "warn" ? (
          <AlertTriangle className="w-5 h-5 text-nexpura-amber-muted" aria-hidden />
        ) : showStatusIcon && style === "success" ? (
          <CheckCircle className="w-5 h-5 text-nexpura-emerald-deep" aria-hidden />
        ) : (
          <ChevronRight
            className="w-5 h-5 text-nexpura-taupe-400 group-hover:translate-x-0.5 transition-transform duration-200"
            aria-hidden
          />
        )}
      </div>
    </Link>
  );
}

// ─── Module Command Card ───────────────────────────────────────────────────

type ModuleCardProps = {
  label: string;
  primary: { value: string; subtitle?: string };
  signals: Array<{ value: string; tone: "neutral" | "danger" | "warn" | "success" }>;
  primaryCta: { label: string; href: string };
  secondaryCtas?: Array<{ label: string; href: string }>;
  emptyMessage?: string;
  isEmpty?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

function ModuleCard({
  label,
  primary,
  signals,
  primaryCta,
  secondaryCtas,
  emptyMessage,
  isEmpty,
  icon: Icon,
}: ModuleCardProps) {
  return (
    <Card className="group relative bg-nexpura-ivory-elevated border-nexpura-taupe-100 hover:border-nexpura-taupe-200 hover:shadow-md transition-all duration-200 flex flex-col">
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400">
            {label}
          </p>
          <Icon className="w-4 h-4 text-nexpura-taupe-400" aria-hidden />
        </div>

        {isEmpty && emptyMessage ? (
          <div className="flex-1 flex flex-col justify-center min-h-[72px]">
            <p className="font-sans text-[13px] text-nexpura-charcoal-500 leading-relaxed">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 min-h-[72px]">
            <div>
              <p className="font-sans text-[24px] font-medium tracking-[-0.01em] text-nexpura-charcoal leading-none tabular-nums">
                {primary.value}
              </p>
              {primary.subtitle && (
                <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-1.5">
                  {primary.subtitle}
                </p>
              )}
            </div>
            {signals.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {signals.map((s, i) => (
                  <span
                    key={i}
                    className={`font-sans text-[12px] tabular-nums ${
                      s.tone === "danger"
                        ? "text-nexpura-oxblood"
                        : s.tone === "warn"
                          ? "text-nexpura-amber-muted"
                          : s.tone === "success"
                            ? "text-nexpura-emerald-deep"
                            : "text-nexpura-charcoal-500"
                    }`}
                  >
                    {s.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-nexpura-taupe-100">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-1 font-sans text-[13px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-charcoal transition-colors"
          >
            {primaryCta.label}
            <ChevronRight
              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200"
              aria-hidden
            />
          </Link>
          {secondaryCtas && secondaryCtas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {secondaryCtas.map((cta) => (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-nexpura-ivory border border-nexpura-taupe-100 font-sans text-[11px] font-medium text-nexpura-charcoal-500 hover:bg-white hover:border-nexpura-taupe-200 hover:text-nexpura-charcoal-700 transition-colors"
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Location empty gate (preserved from prior version) ────────────────────

function DashboardLocationEmptyGate({
  hasAnyActivity,
  isStatsLoading,
}: {
  hasAnyActivity: boolean;
  isStatsLoading: boolean;
}) {
  const { currentLocation, hasMultipleLocations, isLoading } = useLocation();
  if (isLoading || !hasMultipleLocations) return null;
  if (!currentLocation) return null;
  if (isStatsLoading) return null;
  if (hasAnyActivity) return null;
  return (
    <section className="bg-nexpura-amber-bg/60 border border-nexpura-taupe-100 rounded-xl px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-nexpura-amber-bg border border-nexpura-taupe-100 flex items-center justify-center">
          <MapPin size={16} className="text-nexpura-amber-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-[16px] text-nexpura-charcoal leading-tight">
            No activity yet at{" "}
            <span className="font-semibold">{currentLocation.name}</span>
          </h3>
          <p className="font-sans text-[13px] text-nexpura-charcoal-500 mt-1 leading-relaxed">
            Sales, repairs, bespoke jobs and invoices attached to this location will appear here. Switch to{" "}
            <span className="font-medium text-nexpura-charcoal-700">All Locations</span> in the header to see the whole business.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DashboardClient({
  basePath = "",
  tenantName,
  activeRepairsCount,
  activeJobsCount,
  overdueInvoiceCount,
  totalOutstanding,
  salesThisMonthRevenue,
  salesThisMonthCount,
  lowStockItems,
  overdueRepairs,
  readyForPickup,
  recentActivity,
  myTasks,
  activeRepairs,
  activeBespokeJobs,
  currency,
  recentSales,
  recentRepairsList,
  isStatsLoading = false,
}: DashboardClientProps) {
  const bp = basePath || "";
  const activeJobsTotal = activeRepairsCount + activeJobsCount;

  // KPI chip set — Section 3.2.
  // Routes: workshop/jobs, invoices and inventory query-string filters are
  // being built in parallel in the workspace redesign track. We emit the
  // intended hrefs now so the wiring is correct the moment those filters
  // land. Until then they degrade to the existing list pages (which ignore
  // the unknown query params).
  const kpis: Array<{ label: string; count: number; href: string; style: KpiStyle }> = [
    {
      label: "Active jobs",
      count: activeJobsTotal,
      href: `${bp}/workshop?status=active`,
      style: "neutral",
    },
    {
      label: "Overdue jobs",
      count: overdueRepairs.length,
      href: `${bp}/workshop?status=overdue`,
      style: overdueRepairs.length > 0 ? "danger" : "neutral",
    },
    {
      label: "Ready for pickup",
      count: readyForPickup.length,
      href: `${bp}/workshop?status=ready-for-pickup`,
      style: readyForPickup.length > 0 ? "success" : "neutral",
    },
    {
      label: "Overdue invoices",
      count: overdueInvoiceCount,
      href: `${bp}/invoices?status=overdue`,
      style: overdueInvoiceCount > 0 ? "danger" : "neutral",
    },
    {
      label: "Low stock",
      count: lowStockItems.length,
      href: `${bp}/inventory?status=low-stock`,
      style: lowStockItems.length > 0 ? "warn" : "neutral",
    },
  ];

  const hasAnyActivity =
    activeJobsTotal +
      overdueInvoiceCount +
      Math.round(totalOutstanding * 100) +
      Math.round(salesThisMonthRevenue * 100) +
      salesThisMonthCount +
      lowStockItems.length +
      overdueRepairs.length +
      readyForPickup.length +
      recentSales.length +
      recentRepairsList.length +
      activeRepairs.length +
      activeBespokeJobs.length >
    0;

  // Module Command Grid (Section 3.3). Eight cards in a 4-col desktop /
  // 2-col tablet / 1-col mobile grid. Each card derives its primary metric,
  // signals and CTAs from the data already in scope. Anything we don't yet
  // compute on the server (customer totals, marketing campaigns, website
  // health) renders the brief's empty-state copy rather than a fabricated
  // number.

  // Most-recent sale snippet: the precomputed slice carries id +
  // sale_number + customer (no amount). The brief's "amount + relative
  // time" accent is omitted until that slice grows; we surface customer
  // name + sale number.
  const recentSale = recentSales[0];
  const recentRepair = recentRepairsList[0];
  const recentJobActivity = recentActivity.find((a) => a.type === "job") ?? recentActivity[0];

  const overdueJobsCount = overdueRepairs.length;
  const readyForPickupCount = readyForPickup.length;
  const lowStockCount = lowStockItems.length;
  const outOfStockCount = lowStockItems.filter((i) => i.quantity === 0).length;

  return (
    <div className="flex gap-7 items-start min-h-0">
      {/* ── Main column ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-7">
        <PageHeader tenantName={tenantName} />

        <DashboardLocationEmptyGate
          hasAnyActivity={hasAnyActivity}
          isStatsLoading={isStatsLoading}
        />

        {/* KPI status strip */}
        <section aria-label="Key performance indicators">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((kpi) => (
              <KpiChip
                key={kpi.label}
                label={kpi.label}
                count={kpi.count}
                href={kpi.href}
                style={kpi.style}
              />
            ))}
          </div>
        </section>

        {/* Module Command Grid */}
        <section aria-label="Modules">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* 1. Sales */}
            <ModuleCard
              icon={ShoppingBag}
              label="Sales"
              isEmpty={salesThisMonthCount === 0 && recentSales.length === 0}
              emptyMessage="No sales recorded yet. Create a POS sale, invoice, quote or layby to begin tracking client revenue."
              primary={{
                value: formatCurrency(salesThisMonthRevenue, currency),
                subtitle: `${salesThisMonthCount} sale${salesThisMonthCount === 1 ? "" : "s"} this month`,
              }}
              signals={[
                ...(overdueInvoiceCount > 0
                  ? [
                      {
                        value: `${overdueInvoiceCount} open invoice${overdueInvoiceCount === 1 ? "" : "s"}`,
                        tone: "warn" as const,
                      },
                    ]
                  : []),
                ...(recentSale
                  ? [
                      {
                        value: `Recent: ${recentSale.customer ?? "Walk-in"} · #${recentSale.saleNumber}`,
                        tone: "neutral" as const,
                      },
                    ]
                  : []),
              ]}
              primaryCta={{ label: "View sales", href: `${bp}/sales` }}
              secondaryCtas={[
                { label: "New sale", href: `${bp}/sales/new` },
                { label: "POS", href: `${bp}/pos` },
              ]}
            />

            {/* 2. Workshop */}
            <ModuleCard
              icon={Wrench}
              label="Workshop"
              isEmpty={activeJobsTotal === 0 && overdueJobsCount === 0 && readyForPickupCount === 0}
              emptyMessage="No active jobs today. Create a repair, bespoke job or appraisal from the workshop."
              primary={{
                value: String(activeJobsTotal),
                subtitle: `Active repair${activeJobsTotal === 1 ? "" : "s"} & jobs`,
              }}
              signals={[
                {
                  value: `${overdueJobsCount} overdue`,
                  tone: overdueJobsCount > 0 ? "danger" : "neutral",
                },
                {
                  value: `${readyForPickupCount} ready`,
                  tone: readyForPickupCount > 0 ? "success" : "neutral",
                },
                ...(recentRepair
                  ? [
                      {
                        value: `Recent: ${recentRepair.customer ?? "—"} · #${recentRepair.repairNumber}`,
                        tone: "neutral" as const,
                      },
                    ]
                  : []),
              ]}
              primaryCta={{ label: "Open workshop", href: `${bp}/workshop` }}
              secondaryCtas={[{ label: "New repair", href: `${bp}/repairs/new` }]}
            />

            {/* 3. Inventory */}
            <ModuleCard
              icon={PackageOpen}
              label="Inventory"
              isEmpty={lowStockCount === 0 && activeJobsTotal === 0 && recentSales.length === 0}
              emptyMessage="Build your inventory library. Add finished pieces, materials, memo items and website stock."
              primary={{
                value: lowStockCount > 0 ? `${lowStockCount} low` : "Healthy",
                subtitle: lowStockCount > 0 ? "Items at or below threshold" : "All stock levels healthy",
              }}
              signals={[
                ...(outOfStockCount > 0
                  ? [
                      {
                        value: `${outOfStockCount} out of stock`,
                        tone: "danger" as const,
                      },
                    ]
                  : []),
                ...(lowStockCount > 0 && outOfStockCount < lowStockCount
                  ? [
                      {
                        value: `${lowStockCount - outOfStockCount} low stock`,
                        tone: "warn" as const,
                      },
                    ]
                  : []),
              ]}
              primaryCta={{ label: "View inventory", href: `${bp}/inventory` }}
              secondaryCtas={[
                { label: "Add item", href: `${bp}/inventory/new` },
                { label: "Receive stock", href: `${bp}/inventory/receive` },
              ]}
            />

            {/* 4. Customers */}
            <ModuleCard
              icon={Users}
              label="Customers"
              isEmpty={recentActivity.length === 0 && recentSales.length === 0}
              emptyMessage="No customer activity yet. Create a profile to start tracking purchases, repairs and follow-ups."
              primary={{
                value: recentSale?.customer ?? recentJobActivity?.customerName ?? "—",
                subtitle: recentJobActivity
                  ? `Latest activity ${relativeTime(recentJobActivity.updatedAt)}`
                  : "Browse the directory",
              }}
              signals={[
                ...(myTasks.length > 0
                  ? [
                      {
                        value: `${myTasks.length} follow-up${myTasks.length === 1 ? "" : "s"} due`,
                        tone: "warn" as const,
                      },
                    ]
                  : []),
              ]}
              primaryCta={{ label: "View customers", href: `${bp}/customers` }}
              secondaryCtas={[{ label: "New customer", href: `${bp}/customers/new` }]}
            />

            {/* 5. Finance */}
            <ModuleCard
              icon={Wallet}
              label="Finance"
              isEmpty={totalOutstanding === 0 && overdueInvoiceCount === 0 && salesThisMonthRevenue === 0}
              emptyMessage="No invoices or revenue yet. Issue an invoice or close a sale to populate finance."
              primary={{
                value: formatCurrency(totalOutstanding, currency),
                subtitle: "Outstanding across open invoices",
              }}
              signals={[
                {
                  value: `${overdueInvoiceCount} overdue`,
                  tone: overdueInvoiceCount > 0 ? "danger" : "neutral",
                },
                {
                  value: `${formatCurrency(salesThisMonthRevenue, currency)} paid this month`,
                  tone: salesThisMonthRevenue > 0 ? "success" : "neutral",
                },
              ]}
              primaryCta={{ label: "View finance", href: `${bp}/financials` }}
              secondaryCtas={[{ label: "Invoices", href: `${bp}/invoices` }]}
            />

            {/* 6. Marketing — campaign counts not in stats payload yet. */}
            <ModuleCard
              icon={Megaphone}
              label="Marketing"
              isEmpty
              emptyMessage="No active campaigns yet. Build your first email or SMS broadcast from the marketing module."
              primary={{ value: "—" }}
              signals={[]}
              primaryCta={{ label: "View marketing", href: `${bp}/marketing` }}
              secondaryCtas={[
                { label: "Campaigns", href: `${bp}/marketing/campaigns` },
                { label: "Segments", href: `${bp}/marketing/segments` },
              ]}
            />

            {/* 7. Digital — routed to /website until /digital is built. */}
            <ModuleCard
              icon={Globe}
              label="Digital"
              isEmpty
              emptyMessage="Connect your website or build one in Nexpura to start tracking digital reach."
              primary={{ value: "Not connected" }}
              signals={[
                { value: "Passport: standby", tone: "neutral" },
                { value: "Integrations: 0", tone: "neutral" },
              ]}
              primaryCta={{ label: "View digital", href: `${bp}/website` }}
              secondaryCtas={[{ label: "Connect site", href: `${bp}/website/connect` }]}
            />

            {/* 8. Admin — tenant admin lives at /settings; /admin is platform-only. */}
            <ModuleCard
              icon={Settings}
              label="Admin"
              isEmpty={myTasks.length === 0}
              emptyMessage="Settings, billing and team controls live here. Nothing demanding attention right now."
              primary={{
                value:
                  myTasks.length > 0
                    ? `${myTasks.length} task${myTasks.length === 1 ? "" : "s"}`
                    : "All clear",
                subtitle: myTasks.length > 0 ? "Due today" : "No tasks due today",
              }}
              signals={[]}
              primaryCta={{ label: "Open admin", href: `${bp}/settings` }}
              secondaryCtas={[
                { label: "Billing", href: `${bp}/billing` },
                { label: "Team", href: `${bp}/settings/roles` },
              ]}
            />
          </div>
        </section>
      </div>

      {/* ── Right sidebar (320px sticky on xl+) ───────────────────────── */}
      <DashboardSidebar
        bp={bp}
        isStatsLoading={isStatsLoading}
        myTasks={myTasks}
        readyForPickup={readyForPickup}
        overdueRepairs={overdueRepairs}
        recentSales={recentSales}
        recentRepairsList={recentRepairsList}
        recentActivity={recentActivity}
        lowStockItems={lowStockItems}
      />
    </div>
  );
}
