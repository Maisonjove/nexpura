"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { DashboardClock } from "./DashboardClock";
import { useLocation } from "@/contexts/LocationContext";
import { MapPin, Layers } from "lucide-react";

/**
 * Thin orchestrator for the dashboard shell.
 *
 * Client surface intentionally kept small — this file used to be 800+
 * lines of JSX, icon SVGs, SECTIONS data, and drill-down logic. The
 * same user-visible behaviour is now split across:
 *
 *  - DashboardClock              (tiny client island, clock state only)
 *  - DashboardCategoryGrid       (dynamic-loaded chunk; 8-card grid +
 *                                 drill-down + ModuleDataPanel lazy)
 *  - DashboardSidebar            (dynamic-loaded chunk; no hooks)
 *  - This file                   (header text, summary strip, attention
 *                                 items — statically rendered JSX, no
 *                                 state, no effects)
 *
 * Why: hydration cost is dominated by the main-bundle JS download +
 * parse + React tree matching. Splitting the grid into a separate chunk
 * lets the main dashboard bundle parse and hydrate faster; the grid
 * chunk loads in parallel and attaches its own state handlers without
 * gating the rest of the shell.
 */

// Category grid is split into its own chunk. SSR'd (so there is no
// layout shift) but its client JS is in a separate bundle. Main
// dashboard bundle parses faster; grid hydrates independently.
const DashboardCategoryGrid = dynamic(() => import("./DashboardCategoryGrid"), {
  ssr: true,
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl p-5 animate-pulse h-[128px]">
          <div className="w-9 h-9 rounded-lg bg-stone-100 mb-3" />
          <div className="h-3 w-20 bg-stone-100 rounded mb-1.5" />
          <div className="h-3 w-32 bg-stone-100 rounded" />
        </div>
      ))}
    </div>
  ),
});

// Sidebar kept in its own chunk per the prior pass. Its file retains
// "use client" (React RSC forbids importing a server component into a
// client module — this file is still a client component).
const DashboardSidebar = dynamic(() => import("./DashboardSidebar"), {
  ssr: true,
  loading: () => (
    <aside className="hidden lg:flex flex-col gap-4 w-[256px] flex-shrink-0">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl p-5 animate-pulse">
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

// Small chevron used by attention-list rows. Kept here because it's the
// only SVG in the trimmed bundle.
const chevronRight = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Dashboard heading that swaps between "All Locations" identity and the
// specific selected location. When a single location is chosen, that
// location's name becomes the primary heading and the tenant name
// drops to a small subtitle — the jeweller should feel the context has
// genuinely switched, not just that a tiny chip turned orange. Reads
// the same LocationContext that DashboardWrapper uses for its SWR key,
// so the heading and the numbers below can never disagree about which
// slice is being shown.
function DashboardHeading({ tenantName }: { tenantName: string | null }) {
  const { currentLocation, hasMultipleLocations, isLoading } = useLocation();
  const tenantLabel = tenantName?.trim() || "Dashboard";

  if (isLoading || !hasMultipleLocations) {
    return (
      <>
        <h1 className="font-serif text-[1.625rem] font-normal tracking-[-0.015em] text-stone-900 leading-tight">
          {tenantLabel}
        </h1>
        <p className="text-[0.8rem] text-stone-400 mt-1 leading-relaxed">
          Overview of sales, workshop activity, inventory, customers, and daily operations
        </p>
      </>
    );
  }

  if (currentLocation) {
    return (
      <>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-100 border border-amber-200 text-[0.7rem] font-semibold tracking-wider uppercase text-amber-900 mb-2">
          <MapPin size={12} className="text-amber-800" />
          Location view
        </div>
        <h1 className="font-serif text-[1.625rem] font-normal tracking-[-0.015em] text-stone-900 leading-tight">
          {currentLocation.name}
        </h1>
        <p className="text-[0.8rem] text-stone-500 mt-1 leading-relaxed">
          <span className="font-medium text-stone-700">{tenantLabel}</span>
          <span className="mx-1.5 text-stone-300">·</span>
          Only activity scoped to this location
        </p>
      </>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 text-[0.7rem] font-semibold tracking-wider uppercase text-stone-700 mb-2">
        <Layers size={12} className="text-stone-600" />
        All locations
      </div>
      <h1 className="font-serif text-[1.625rem] font-normal tracking-[-0.015em] text-stone-900 leading-tight">
        {tenantLabel}
      </h1>
      <p className="text-[0.8rem] text-stone-400 mt-1 leading-relaxed">
        Overview of sales, workshop activity, inventory, customers, and daily operations
      </p>
    </>
  );
}

// Decides whether to render the location-scoped empty state. Only shows
// when (a) a specific location is selected, (b) the tenant actually has
// multiple locations, (c) stats have finished loading (no flash during
// skeleton), and (d) every headline metric on the dashboard is zero.
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
  return <DashboardLocationEmpty locationName={currentLocation.name} />;
}

// Shown when a specific location is selected AND every headline metric is
// zero. Distinguishes "this jeweller genuinely has no activity at this
// location yet" from "something is broken". Without it the dashboard
// cards full of zeros look like a bug, not an empty state.
function DashboardLocationEmpty({ locationName }: { locationName: string }) {
  return (
    <section className="bg-amber-50/50 border border-amber-100 rounded-xl px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
          <MapPin size={16} className="text-amber-800" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-[1rem] text-stone-900 leading-tight">
            No activity yet at <span className="font-semibold">{locationName}</span>
          </h3>
          <p className="text-[0.8rem] text-stone-500 mt-1 leading-relaxed">
            Sales, repairs, bespoke jobs and invoices attached to this location will appear here. Switch to <span className="font-medium text-stone-700">All Locations</span> in the header to see the whole business, or start a sale/repair intake with this location selected.
          </p>
        </div>
      </div>
    </section>
  );
}

function AttentionRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3 hover:bg-white/80 transition-colors duration-150 group"
    >
      {children}
      <span className="text-stone-300 group-hover:text-stone-500 transition-colors flex-shrink-0 ml-auto">
        {chevronRight}
      </span>
    </Link>
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
  myTasks,
  activeRepairs,
  activeBespokeJobs,
  currency,
  recentSales,
  recentRepairsList,
  isStatsLoading = false,
}: DashboardClientProps) {
  const bp = basePath || "";

  // Attention items are pure server-rendered JSX — no state, no effects.
  // Built once per render from the stats props.
  const attentionItems = [
    ...overdueRepairs.map((r) => ({
      key: `repair-${r.id}`,
      dot: "red" as const,
      id: r.repairNumber,
      label: r.item,
      sub: r.customer,
      type: "Repair",
      status: `${r.daysOverdue}d overdue`,
      statusColor: "text-red-500",
      href: `${bp}/repairs/${r.id}`,
    })),
    ...readyForPickup.map((r) => ({
      key: `ready-${r.id}`,
      dot: "green" as const,
      id: r.number,
      label: r.label,
      sub: r.customer,
      type: r.type === "repair" ? "Repair" : "Bespoke",
      status: "Ready for pickup",
      statusColor: "text-emerald-600",
      href: `${bp}/${r.type === "repair" ? "repairs" : "bespoke"}/${r.id}`,
    })),
    ...myTasks
      .filter((t) => t.status !== "completed" && t.status !== "done")
      .map((t) => ({
        key: `task-${t.id}`,
        dot: (t.priority === "urgent" ? "red" : "amber") as "red" | "amber",
        id: t.id.slice(0, 8),
        label: t.title,
        sub: null,
        type: "Task",
        status: t.due_date
          ? `Due ${new Date(t.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
          : t.priority,
        statusColor: t.priority === "urgent" ? "text-red-500" : "text-amber-600",
        href: `${bp}/tasks`,
      })),
    ...lowStockItems.map((s) => ({
      key: `stock-${s.id}`,
      dot: (s.quantity === 0 ? "red" : "amber") as "red" | "amber",
      id: s.sku || s.id.slice(0, 8),
      label: s.name,
      sub: null,
      type: "Inventory",
      status: s.quantity === 0 ? "Out of stock" : `Qty: ${s.quantity}`,
      statusColor: s.quantity === 0 ? "text-red-500" : "text-amber-600",
      href: `${bp}/inventory`,
    })),
  ];

  const dotColor: Record<string, string> = {
    red: "bg-red-400",
    green: "bg-emerald-400",
    amber: "bg-amber-400",
  };

  // "Empty" means every headline number is zero. Only treated as empty
  // when a specific location is selected AND genuinely has no activity —
  // that's the state worth explaining to the jeweller. In the All
  // Locations view a zero-state at this layer would just be noise.
  const hasAnyActivity =
    activeRepairsCount +
      activeJobsCount +
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

  return (
    <div className="flex gap-7 items-start min-h-0">
      {/* ── Main Column ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <DashboardHeading tenantName={tenantName} />
          </div>
          <DashboardClock />
        </div>

        <DashboardLocationEmptyGate hasAnyActivity={hasAnyActivity} isStatsLoading={isStatsLoading} />

        {/* Summary strip */}
        <div className="flex flex-wrap gap-1.5 -mt-2">
          {[
            { label: "Active jobs", count: activeRepairsCount + activeJobsCount, href: `${bp}/workshop`, style: "neutral" },
            { label: "Overdue jobs", count: overdueRepairs.length, href: `${bp}/repairs?filter=overdue`, style: overdueRepairs.length > 0 ? "danger" : "neutral" },
            { label: "Ready for pickup", count: readyForPickup.length, href: `${bp}/repairs?filter=ready`, style: readyForPickup.length > 0 ? "success" : "neutral" },
            { label: "Overdue invoices", count: overdueInvoiceCount, href: `${bp}/invoices?filter=overdue`, style: overdueInvoiceCount > 0 ? "danger" : "neutral" },
            { label: "Low stock", count: lowStockItems.length, href: `${bp}/inventory`, style: lowStockItems.length > 0 ? "warn" : "neutral" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[0.75rem] border font-medium transition-all duration-200
                ${item.style === "danger" ? "bg-red-50 border-red-100 text-red-600 hover:bg-red-100" :
                  item.style === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                  item.style === "warn" ? "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100" :
                  "bg-stone-50 border-stone-200 text-stone-500 hover:bg-white hover:border-stone-300"}`}
            >
              <span className={`text-[0.875rem] font-semibold tabular-nums
                ${item.style === "danger" ? "text-red-700" :
                  item.style === "success" ? "text-emerald-800" :
                  item.style === "warn" ? "text-amber-800" :
                  "text-stone-700"}`}>
                {item.count}
              </span>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Needs attention */}
        {attentionItems.length > 0 && (
          <section key="attention" className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">Needs Attention</h2>
              <span className="text-[0.75rem] text-stone-400">{attentionItems.length} item{attentionItems.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] divide-y divide-[#F0EDE9]">
              {attentionItems.map((item) => (
                <AttentionRow key={item.key} href={item.href}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[item.dot]}`} />
                  <span className="text-[0.7rem] font-mono text-stone-300 w-[5rem] truncate flex-shrink-0">{item.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] text-stone-800 font-medium truncate">{item.label}</p>
                    {item.sub && <p className="text-[0.75rem] text-stone-400 truncate">{item.sub}</p>}
                  </div>
                  <span className="text-[0.75rem] text-stone-400 flex-shrink-0 hidden sm:block">{item.type}</span>
                  <span className={`text-[0.75rem] font-medium flex-shrink-0 ${item.statusColor}`}>{item.status}</span>
                </AttentionRow>
              ))}
            </div>
          </section>
        )}

        {/* Category grid + drill-down — dynamic chunk */}
        <DashboardCategoryGrid
          bp={bp}
          salesThisMonthCount={salesThisMonthCount}
          activeRepairsCount={activeRepairsCount}
          activeJobsCount={activeJobsCount}
          overdueInvoiceCount={overdueInvoiceCount}
          totalOutstanding={totalOutstanding}
          currency={currency}
          lowStockItems={lowStockItems}
          overdueRepairs={overdueRepairs}
          readyForPickup={readyForPickup}
          activeRepairs={activeRepairs}
          activeBespokeJobs={activeBespokeJobs}
          recentSales={recentSales}
          myTasks={myTasks}
        />
      </div>

      {/* ── Right Sidebar (lazy-loaded chunk) ─────────────────────────── */}
      <DashboardSidebar
        bp={bp}
        isStatsLoading={isStatsLoading}
        myTasks={myTasks}
        readyForPickup={readyForPickup}
        overdueRepairs={overdueRepairs}
        recentSales={recentSales}
        recentRepairsList={recentRepairsList}
      />
    </div>
  );
}
