"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Types (mirrors DashboardClient; kept local so this chunk is standalone) ──

type ActiveRepair = { id: string; customer: string | null; item: string; stage: string; due_date: string | null };
type ActiveBespokeJob = { id: string; customer: string | null; title: string; stage: string; due_date: string | null };
type LowStockItem = { id: string; name: string; sku: string | null; quantity: number };
type OverdueRepair = { id: string; repairNumber: string; item: string; customer: string | null; daysOverdue: number };
type ReadyItem = { id: string; number: string; label: string; customer: string | null; type: "repair" | "bespoke" };

// ─── Helpers (kept local so this chunk has no cross-file runtime deps) ────────

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatStageLabel(stage: string) {
  return stage.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

const chevronRight = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

function TableRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    // next/link: SPA-style navigation + viewport-based prefetch. Plain
    // <a href> was causing a full page reload on every dashboard row
    // click, discarding the entire client state.
    <Link href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-white/80 transition-colors duration-150 group">
      {children}
      <span className="text-stone-300 group-hover:text-stone-500 transition-colors flex-shrink-0 ml-auto">{chevronRight}</span>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-5 text-center">
      <p className="text-[0.8125rem] text-stone-400">{message}</p>
    </div>
  );
}

function PanelHeader({ label, href, linkText = "View all →" }: { label: string; href?: string; linkText?: string }) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-[#E8E4DF] flex items-center justify-between">
      <span className="text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-stone-400">{label}</span>
      {href && (
        <Link href={href} className="text-[0.75rem] text-stone-400 hover:text-stone-700 transition-colors">{linkText}</Link>
      )}
    </div>
  );
}

// ─── WorkshopPanel (tabs over active / overdue / ready / completed jobs) ──────

type WorkshopTab = "all" | "overdue" | "active" | "ready" | "completed";

function WorkshopPanel({
  bp, activeRepairs, activeBespokeJobs, overdueRepairs, readyForPickup,
}: {
  bp: string;
  activeRepairs: ActiveRepair[];
  activeBespokeJobs: ActiveBespokeJob[];
  overdueRepairs: OverdueRepair[];
  readyForPickup: ReadyItem[];
}) {
  const [tab, setTab] = useState<WorkshopTab>("all");

  const allJobs = [
    ...activeRepairs.map((r) => ({ id: r.id, number: r.id.slice(0, 8), label: r.item, customer: r.customer, type: "Repair" as const, stage: r.stage, due_date: r.due_date, href: `${bp}/repairs/${r.id}` })),
    ...activeBespokeJobs.map((j) => ({ id: j.id, number: j.id.slice(0, 8), label: j.title, customer: j.customer, type: "Bespoke" as const, stage: j.stage, due_date: j.due_date, href: `${bp}/bespoke/${j.id}` })),
  ];

  const overdueIds = new Set(overdueRepairs.map((r) => r.id));
  const readyIds = new Set(readyForPickup.map((r) => r.id));

  const tabData: Record<WorkshopTab, typeof allJobs> = {
    all: allJobs,
    overdue: allJobs.filter((j) => overdueIds.has(j.id)),
    active: allJobs.filter((j) => !overdueIds.has(j.id) && !readyIds.has(j.id) && j.stage !== "completed" && j.stage !== "collected"),
    ready: allJobs.filter((j) => readyIds.has(j.id) || j.stage === "ready"),
    completed: allJobs.filter((j) => j.stage === "completed" || j.stage === "collected"),
  };

  const TABS: { key: WorkshopTab; label: string; count: number }[] = [
    { key: "all", label: "All Jobs", count: tabData.all.length },
    { key: "overdue", label: "Overdue", count: overdueRepairs.length },
    { key: "active", label: "Active", count: tabData.active.length },
    { key: "ready", label: "Ready for Pickup", count: tabData.ready.length },
    { key: "completed", label: "Completed", count: tabData.completed.length },
  ];

  const rows = tab === "overdue"
    ? overdueRepairs.map((r) => ({ id: r.id, number: r.repairNumber, label: r.item, customer: r.customer, type: "Repair" as const, stage: "overdue", due_date: null as string | null, daysOverdue: r.daysOverdue, href: `${bp}/repairs/${r.id}` }))
    : tabData[tab];

  return (
    <div className="mb-6 bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex gap-0 border-b border-[#E8E4DF] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-[0.75rem] font-medium whitespace-nowrap border-b-2 transition-all duration-150 cursor-pointer
              ${tab === t.key ? "border-stone-900 text-stone-900" : "border-transparent text-stone-400 hover:text-stone-700"}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`inline-flex items-center justify-center rounded-full text-[0.625rem] font-semibold min-w-[16px] h-4 px-1
                ${tab === t.key
                  ? t.key === "overdue" ? "bg-red-100 text-red-700" : "bg-stone-900 text-white"
                  : t.key === "overdue" && t.count > 0 ? "bg-red-50 text-red-500" : "bg-stone-100 text-stone-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-[#F0EDE9]">
          {rows.map((job) => {
            const days = "daysOverdue" in job ? -(job as { daysOverdue: number }).daysOverdue : daysUntil(job.due_date);
            return (
              <TableRow key={job.id} href={job.href}>
                <span className="text-[0.7rem] font-mono text-stone-300 w-[5.5rem] truncate flex-shrink-0">{job.number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] text-stone-800 font-medium truncate">{job.label}</p>
                  {job.customer && <p className="text-[0.75rem] text-stone-400 truncate">{job.customer}</p>}
                </div>
                <span className="text-[0.75rem] text-stone-400 flex-shrink-0 hidden sm:block">{job.type}</span>
                <span className="text-[0.75rem] flex-shrink-0 hidden md:block text-stone-400">{formatStageLabel(job.stage)}</span>
                {"daysOverdue" in job ? (
                  <span className="text-[0.75rem] text-red-500 font-medium flex-shrink-0">{(job as { daysOverdue: number }).daysOverdue}d overdue</span>
                ) : days !== null ? (
                  <span className={`text-[0.75rem] flex-shrink-0 font-medium ${days < 0 ? "text-red-500" : days <= 2 ? "text-amber-600" : "text-stone-400"}`}>
                    {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? "Due today" : `${days}d left`}
                  </span>
                ) : null}
              </TableRow>
            );
          })}
        </div>
      ) : (
        <EmptyState message={
          tab === "overdue" ? "No overdue jobs" :
          tab === "active" ? "No active jobs" :
          tab === "ready" ? "Nothing ready for pickup" :
          tab === "completed" ? "No completed jobs" :
          "No jobs found"
        } />
      )}
    </div>
  );
}

// ─── ModuleDataPanel (the drill-down panel shown when a category is clicked) ──

export default function ModuleDataPanel({
  sectionId, bp, salesThisMonthCount, currency, lowStockItems, overdueRepairs,
  readyForPickup, activeRepairs, activeBespokeJobs, recentSales, overdueInvoiceCount,
  totalOutstanding, myTasks,
}: {
  sectionId: string;
  bp: string;
  salesThisMonthCount: number;
  currency: string;
  lowStockItems: LowStockItem[];
  overdueRepairs: OverdueRepair[];
  readyForPickup: ReadyItem[];
  activeRepairs: ActiveRepair[];
  activeBespokeJobs: ActiveBespokeJob[];
  recentSales: { id: string; saleNumber: string; customer: string | null }[];
  overdueInvoiceCount: number;
  totalOutstanding: number;
  myTasks: { id: string; title: string; priority: string; status: string; due_date: string | null }[];
}) {
  const panelClass = "mb-6 bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]";

  if (sectionId === "sales") return (
    <div className={panelClass}>
      <PanelHeader label="Recent Sales" href={`${bp}/sales`} />
      {recentSales.length > 0 ? (
        <div className="divide-y divide-[#F0EDE9]">
          {recentSales.map((sale) => (
            <TableRow key={sale.id} href={`${bp}/sales/${sale.id}`}>
              <span className="text-[0.7rem] font-mono text-stone-300 w-12 flex-shrink-0">{sale.saleNumber}</span>
              <span className="text-[0.8125rem] text-stone-800 flex-1 font-medium">{sale.customer || "Walk-in"}</span>
              <span className="text-[0.75rem] text-stone-400">Sale</span>
            </TableRow>
          ))}
        </div>
      ) : <EmptyState message="No recent sales" />}
      <div className="px-5 py-3 border-t border-[#E8E4DF] flex items-center justify-between">
        <span className="text-[0.75rem] text-stone-400">{salesThisMonthCount} sale{salesThisMonthCount !== 1 ? "s" : ""} this month</span>
        <Link href={`${bp}/invoices`} className="text-[0.75rem] text-stone-400 hover:text-stone-700 transition-colors">Invoices →</Link>
      </div>
    </div>
  );

  if (sectionId === "stock") return (
    <div className={panelClass}>
      <PanelHeader label="Inventory Status" href={`${bp}/inventory`} />
      {lowStockItems.length > 0 ? (
        <div className="divide-y divide-[#F0EDE9]">
          {lowStockItems.map((item) => (
            <TableRow key={item.id} href={`${bp}/inventory`}>
              <span className="text-[0.7rem] font-mono text-stone-300 w-20 truncate flex-shrink-0">{item.sku || item.id.slice(0, 8)}</span>
              <span className="text-[0.8125rem] text-stone-800 flex-1 font-medium truncate">{item.name}</span>
              <span className={`text-[0.75rem] font-medium flex-shrink-0 ${item.quantity === 0 ? "text-red-500" : "text-amber-600"}`}>
                {item.quantity === 0 ? "Out of stock" : `Qty: ${item.quantity}`}
              </span>
            </TableRow>
          ))}
        </div>
      ) : <EmptyState message="All stock levels healthy" />}
    </div>
  );

  if (sectionId === "workshop") return (
    <WorkshopPanel
      bp={bp}
      activeRepairs={activeRepairs}
      activeBespokeJobs={activeBespokeJobs}
      overdueRepairs={overdueRepairs}
      readyForPickup={readyForPickup}
    />
  );

  if (sectionId === "finance") return (
    <div className={panelClass}>
      <PanelHeader label="Finance Overview" />
      <div className="divide-y divide-[#F0EDE9]">
        <TableRow href={`${bp}/invoices?filter=overdue`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${overdueInvoiceCount > 0 ? "bg-red-400" : "bg-stone-200"}`} />
          <span className="text-[0.8125rem] text-stone-800 flex-1 font-medium">
            {overdueInvoiceCount > 0 ? `${overdueInvoiceCount} overdue invoice${overdueInvoiceCount !== 1 ? "s" : ""}` : "No overdue invoices"}
          </span>
          {overdueInvoiceCount > 0 && <span className="text-[0.75rem] text-red-500 font-medium">Action needed</span>}
        </TableRow>
        <TableRow href={`${bp}/invoices`}>
          <span className="w-1.5 h-1.5 rounded-full bg-stone-200 flex-shrink-0" />
          <span className="text-[0.8125rem] text-stone-800 flex-1 font-medium">
            Outstanding: {fmtCurrency(totalOutstanding, currency)}
          </span>
        </TableRow>
      </div>
    </div>
  );

  if (sectionId === "customers") return (
    <div className={panelClass}>
      <PanelHeader label="Customer Activity" href={`${bp}/customers`} />
      <EmptyState message="No follow-ups due · Browse customer profiles to get started." />
    </div>
  );

  if (sectionId === "marketing") return (
    <div className={panelClass}>
      <PanelHeader label="Campaign Status" href={`${bp}/marketing`} />
      <EmptyState message="No active campaigns · Create your first campaign to get started." />
    </div>
  );

  if (sectionId === "website") return (
    <div className={panelClass}>
      <PanelHeader label="Digital & Integrations" href={`${bp}/integrations`} />
      <EmptyState message="No integration issues · All systems connected." />
    </div>
  );

  if (sectionId === "admin") {
    const pending = myTasks.filter((t) => t.status !== "completed" && t.status !== "done");
    return (
      <div className={panelClass}>
        <PanelHeader label="Tasks & Admin" href={`${bp}/tasks`} />
        {pending.length > 0 ? (
          <div className="divide-y divide-[#F0EDE9]">
            {pending.map((task) => (
              <TableRow key={task.id} href={`${bp}/tasks`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === "urgent" ? "bg-red-400" : task.priority === "high" ? "bg-amber-400" : "bg-stone-300"}`} />
                <span className="text-[0.8125rem] text-stone-800 flex-1 font-medium truncate">{task.title}</span>
                <span className="text-[0.75rem] text-stone-400 flex-shrink-0 capitalize">{task.priority}</span>
                {task.due_date && (
                  <span className="text-[0.75rem] text-stone-400 flex-shrink-0 hidden sm:block">
                    {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                )}
              </TableRow>
            ))}
          </div>
        ) : <EmptyState message="No admin tasks due" />}
      </div>
    );
  }

  return null;
}
