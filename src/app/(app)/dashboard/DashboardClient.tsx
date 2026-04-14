"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatStageLabel(stage: string) {
  const labels: Record<string, string> = {
    intake: "Intake",
    assessed: "Awaiting Approval",
    quoted: "Quoted",
    approved: "Approved",
    in_progress: "In Workshop",
    quality_check: "Quality Check",
    ready: "Ready for Pickup",
    collected: "Collected",
    cancelled: "Cancelled",
  };
  return labels[stage] || stage.replace(/_/g, " ");
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const icons = {
  plus: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  cart: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  search: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  box: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
  folder: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  userPlus: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  ),
  mail: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  users: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  wrench: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.648 5.648a2.121 2.121 0 01-3-3l5.648-5.648m3-3L19.5 4.5m-8.08 10.67a5.068 5.068 0 01-1.54-3.62c0-1.326.527-2.6 1.46-3.54a5.068 5.068 0 013.54-1.46c1.326 0 2.6.527 3.54 1.46" />
    </svg>
  ),
  hammer: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  dollar: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  megaphone: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  send: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  globe: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  document: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  plug: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.928-2.879a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.5 8.435m9.928 2.879l-4.5 4.5" />
    </svg>
  ),
  creditCard: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  cog: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  chevronLeft: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
};

// ─── Shared table row ─────────────────────────────────────────────────────────

function TableRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-5 py-3 hover:bg-white/80 transition-colors duration-150 group"
    >
      {children}
      <span className="text-stone-300 group-hover:text-stone-500 transition-colors flex-shrink-0 ml-auto">{icons.chevronRight}</span>
    </a>
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
        <a href={href} className="text-[0.75rem] text-stone-400 hover:text-stone-700 transition-colors">
          {linkText}
        </a>
      )}
    </div>
  );
}

// ─── ActionCard ──────────────────────────────────────────────────────────────

function ActionCard({ title, description, icon, href }: { title: string; description: string; icon: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3.5 bg-white border border-[#E8E4DF] rounded-xl px-4 py-3.5
        hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:border-stone-300 hover:-translate-y-px
        transition-all duration-200 cursor-pointer"
    >
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100
        group-hover:bg-stone-900 transition-colors duration-200 text-stone-500 group-hover:text-white">
        {icon}
      </div>
      <div>
        <p className="text-[0.875rem] font-medium text-stone-900 leading-snug">{title}</p>
        <p className="text-[0.75rem] text-stone-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </a>
  );
}

// ─── Workshop Panel with tabs ─────────────────────────────────────────────────

type WorkshopTab = "all" | "overdue" | "active" | "ready" | "completed";

function WorkshopPanel({
  bp,
  activeRepairs,
  activeBespokeJobs,
  overdueRepairs,
  readyForPickup,
}: {
  bp: string;
  activeRepairs: ActiveRepair[];
  activeBespokeJobs: ActiveBespokeJob[];
  overdueRepairs: OverdueRepair[];
  readyForPickup: ReadyItem[];
}) {
  const [tab, setTab] = useState<WorkshopTab>("all");

  const allJobs = [
    ...activeRepairs.map((r) => ({
      id: r.id,
      number: r.id.slice(0, 8),
      label: r.item,
      customer: r.customer,
      type: "Repair" as const,
      stage: r.stage,
      due_date: r.due_date,
      href: `${bp}/repairs/${r.id}`,
    })),
    ...activeBespokeJobs.map((j) => ({
      id: j.id,
      number: j.id.slice(0, 8),
      label: j.title,
      customer: j.customer,
      type: "Bespoke" as const,
      stage: j.stage,
      due_date: j.due_date,
      href: `${bp}/bespoke/${j.id}`,
    })),
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
    ? overdueRepairs.map((r) => ({
        id: r.id,
        number: r.repairNumber,
        label: r.item,
        customer: r.customer,
        type: "Repair" as const,
        stage: "overdue",
        due_date: null as string | null,
        daysOverdue: r.daysOverdue,
        href: `${bp}/repairs/${r.id}`,
      }))
    : tabData[tab];

  return (
    <div className="mb-6 bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#E8E4DF] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-[0.75rem] font-medium whitespace-nowrap border-b-2 transition-all duration-150 cursor-pointer
              ${tab === t.key
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-700"}`}
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

      {/* Rows */}
      {rows.length > 0 ? (
        <div className="divide-y divide-[#F0EDE9]">
          {rows.map((job) => {
            const days = "daysOverdue" in job ? -(job as any).daysOverdue : daysUntil(job.due_date);
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
                  <span className="text-[0.75rem] text-red-500 font-medium flex-shrink-0">{(job as any).daysOverdue}d overdue</span>
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

// ─── Module Data Panel ────────────────────────────────────────────────────────

function ModuleDataPanel({
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
        <a href={`${bp}/invoices`} className="text-[0.75rem] text-stone-400 hover:text-stone-700 transition-colors">Invoices →</a>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  basePath = "",
  firstName,
  tenantName,
  businessType,
  salesThisMonthRevenue,
  salesThisMonthCount,
  activeRepairsCount,
  activeJobsCount,
  totalOutstanding,
  overdueInvoiceCount,
  lowStockItems,
  overdueRepairs,
  readyForPickup,
  recentActivity,
  myTasks,
  teamTaskSummary,
  isManager,
  activeRepairs,
  activeBespokeJobs,
  currency,
  recentSales,
  recentRepairsList,
  isStatsLoading = false,
}: DashboardClientProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const d = now || new Date();
  const bp = basePath || "";

  // ── Section definitions ──────────────────────────────────────────────────
  const SECTIONS = [
    {
      id: "sales",
      title: "Sales",
      description: "Sales, invoices, quotes & POS",
      icon: icons.cart,
      items: [
        { title: "New Intake", description: "Log a new item", icon: icons.clipboard, href: `${bp}/intake` },
        { title: "New Sale", description: "Create a sale", icon: icons.plus, href: `${bp}/sales/new` },
        { title: "POS / Quick Sale", description: "Point of sale terminal", icon: icons.cart, href: `${bp}/pos` },
        { title: "Find Sale", description: "Search previous sales", icon: icons.search, href: `${bp}/sales` },
        { title: "Invoices", description: "Manage invoices", icon: icons.document, href: `${bp}/invoices` },
        { title: "Quotes", description: "Create & manage quotes", icon: icons.document, href: `${bp}/quotes` },
        { title: "Laybys", description: "Layby management", icon: icons.creditCard, href: `${bp}/laybys` },
      ],
    },
    {
      id: "stock",
      title: "Inventory",
      description: "Stock, suppliers & transfers",
      icon: icons.box,
      items: [
        { title: "Enter Stock", description: "Receive stock from a supplier", icon: icons.box, href: `${bp}/inventory/receive` },
        { title: "New Item", description: "Add a new inventory item", icon: icons.folder, href: `${bp}/inventory/new` },
        { title: "Find Item", description: "Search for a stock item", icon: icons.search, href: `${bp}/inventory` },
        { title: "Stocktakes", description: "Count & reconcile stock", icon: icons.clipboard, href: `${bp}/stocktakes` },
        { title: "Stock Transfers", description: "Transfer between locations", icon: icons.box, href: `${bp}/inventory/transfers` },
        { title: "Suppliers", description: "Manage suppliers", icon: icons.users, href: `${bp}/suppliers` },
        { title: "Memo & Consignment", description: "Consignment tracking", icon: icons.document, href: `${bp}/memo` },
      ],
    },
    {
      id: "customers",
      title: "Customers",
      description: "Profiles & communications",
      icon: icons.users,
      items: [
        { title: "New Customer", description: "Create a new customer profile", icon: icons.userPlus, href: `${bp}/customers/new` },
        { title: "Find Customer", description: "Search for a customer profile", icon: icons.users, href: `${bp}/customers` },
        { title: "Communications", description: "View all sent communications", icon: icons.mail, href: `${bp}/communications` },
      ],
    },
    {
      id: "workshop",
      title: "Workshop",
      description: "Repairs, bespoke & appraisals",
      icon: icons.hammer,
      items: [
        { title: "New Repair", description: "Log a repair job", icon: icons.wrench, href: `${bp}/repairs/new` },
        { title: "All Repairs", description: "View all repair jobs", icon: icons.wrench, href: `${bp}/repairs` },
        { title: "Bespoke Job", description: "Start a custom commission", icon: icons.sparkles, href: `${bp}/bespoke/new` },
        { title: "All Bespoke Jobs", description: "View all commissions", icon: icons.sparkles, href: `${bp}/bespoke` },
        { title: "Workshop View", description: "All active jobs", icon: icons.clipboard, href: `${bp}/workshop` },
        { title: "Appraisals", description: "Jewellery appraisals", icon: icons.search, href: `${bp}/appraisals` },
        { title: "Passports", description: "Item passports", icon: icons.document, href: `${bp}/passports` },
      ],
    },
    {
      id: "finance",
      title: "Finance",
      description: "Expenses, reports & reconciliation",
      icon: icons.dollar,
      items: [
        { title: "Expenses", description: "Track business expenses", icon: icons.dollar, href: `${bp}/expenses` },
        { title: "Financials", description: "Financial overview", icon: icons.chart, href: `${bp}/financials` },
        { title: "Reports", description: "Sales & business reports", icon: icons.chart, href: `${bp}/reports` },
        { title: "Refunds", description: "Process refunds", icon: icons.dollar, href: `${bp}/refunds` },
        { title: "Vouchers", description: "Gift vouchers", icon: icons.creditCard, href: `${bp}/vouchers` },
        { title: "End of Day", description: "Daily reconciliation", icon: icons.clipboard, href: `${bp}/eod` },
      ],
    },
    {
      id: "marketing",
      title: "Marketing",
      description: "Campaigns, email & SMS",
      icon: icons.megaphone,
      items: [
        { title: "Overview", description: "Marketing dashboard", icon: icons.megaphone, href: `${bp}/marketing` },
        { title: "Campaigns", description: "Marketing campaigns", icon: icons.megaphone, href: `${bp}/marketing/campaigns` },
        { title: "Bulk Email", description: "Send bulk emails", icon: icons.mail, href: `${bp}/marketing/bulk-email` },
        { title: "Bulk SMS", description: "Send bulk SMS", icon: icons.send, href: `${bp}/marketing/bulk-sms` },
        { title: "Automations", description: "Automated workflows", icon: icons.sparkles, href: `${bp}/marketing/automations` },
        { title: "Segments", description: "Customer segments", icon: icons.users, href: `${bp}/marketing/segments` },
        { title: "Templates", description: "Email & SMS templates", icon: icons.document, href: `${bp}/marketing/templates` },
      ],
    },
    {
      id: "website",
      title: "Digital",
      description: "Website, integrations & migration",
      icon: icons.globe,
      items: [
        { title: "Website Builder", description: "Build your website", icon: icons.globe, href: `${bp}/website` },
        { title: "Connect Website", description: "Link an existing site", icon: icons.plug, href: `${bp}/website/connect` },
        { title: "Migration Hub", description: "Data migration", icon: icons.box, href: `${bp}/migration` },
      ],
    },
    {
      id: "admin",
      title: "Admin",
      description: "Settings, billing & team",
      icon: icons.cog,
      items: [
        { title: "Settings", description: "General settings", icon: icons.cog, href: `${bp}/settings` },
        { title: "Billing", description: "Subscription & billing", icon: icons.creditCard, href: `${bp}/billing` },
        { title: "Team & Roles", description: "Team management", icon: icons.users, href: `${bp}/settings/roles` },
        { title: "Email Domain", description: "Email configuration", icon: icons.mail, href: `${bp}/settings/email` },
        { title: "Notifications", description: "Notification settings", icon: icons.mail, href: `${bp}/settings/notifications` },
        { title: "Integrations", description: "Connected services", icon: icons.plug, href: `${bp}/integrations` },
        { title: "Activity Log", description: "View activity", icon: icons.chart, href: `${bp}/settings/activity` },
        { title: "Tasks", description: "Your task list", icon: icons.clipboard, href: `${bp}/tasks` },
        { title: "AI Copilot", description: "AI assistant", icon: icons.sparkles, href: `${bp}/copilot` },
        { title: "Support", description: "Get help", icon: icons.users, href: `${bp}/support` },
      ],
    },
  ];

  // ── Per-card status lines ────────────────────────────────────────────────
  type StatusInfo = { text: string; alert: boolean };
  const getStatus = (id: string): StatusInfo => {
    switch (id) {
      case "sales":
        return salesThisMonthCount > 0
          ? { text: `${salesThisMonthCount} sale${salesThisMonthCount !== 1 ? "s" : ""} this month`, alert: true }
          : { text: "0 sales recorded this month", alert: false };
      case "stock":
        return lowStockItems.length > 0
          ? { text: `${lowStockItems.filter((i) => i.quantity === 0).length} out of stock · ${lowStockItems.length} low`, alert: true }
          : { text: "All stock levels healthy", alert: false };
      case "customers":
        return { text: "No follow-ups due", alert: false };
      case "workshop": {
        const active = activeRepairsCount + activeJobsCount;
        if (overdueRepairs.length > 0)
          return { text: `${overdueRepairs.length} overdue · ${active} active job${active !== 1 ? "s" : ""}`, alert: true };
        return active > 0
          ? { text: `${active} active job${active !== 1 ? "s" : ""} · 0 overdue`, alert: false }
          : { text: "No active jobs", alert: false };
      }
      case "finance":
        return overdueInvoiceCount > 0
          ? { text: `${overdueInvoiceCount} unpaid invoice${overdueInvoiceCount !== 1 ? "s" : ""} overdue`, alert: true }
          : { text: "No overdue invoices", alert: false };
      case "marketing":
        return { text: "No active campaigns", alert: false };
      case "website":
        return { text: "All systems connected", alert: false };
      case "admin": {
        const pending = myTasks.filter((t) => t.status !== "completed" && t.status !== "done");
        return pending.length > 0
          ? { text: `${pending.length} task${pending.length !== 1 ? "s" : ""} due`, alert: true }
          : { text: "No tasks due", alert: false };
      }
      default:
        return { text: "", alert: false };
    }
  };

  // ── Needs-attention items ────────────────────────────────────────────────
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
    ...myTasks.filter((t) => t.status !== "completed" && t.status !== "done").map((t) => ({
      key: `task-${t.id}`,
      dot: (t.priority === "urgent" ? "red" : "amber") as "red" | "amber",
      id: t.id.slice(0, 8),
      label: t.title,
      sub: null,
      type: "Task",
      status: t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : t.priority,
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

  return (
    <div className="flex gap-7 items-start min-h-0">
      {/* ── Main Column ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-7">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[1.625rem] font-normal tracking-[-0.015em] text-stone-900 leading-tight">
              Nexpura Admin
            </h1>
            <p className="text-[0.8rem] text-stone-400 mt-1 leading-relaxed">
              Overview of sales, workshop activity, inventory, customers, and daily operations
            </p>
          </div>
          <div className="text-right flex-shrink-0 pl-4">
            <p className="text-[0.8125rem] font-medium text-stone-700 tabular-nums">
              {d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-[0.8125rem] text-stone-400 tabular-nums mt-0.5">
              {d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </p>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap gap-1.5 -mt-2">
          {[
            { label: "Active jobs", count: activeRepairsCount + activeJobsCount, href: `${bp}/workshop`, style: "neutral" },
            { label: "Overdue jobs", count: overdueRepairs.length, href: `${bp}/repairs?filter=overdue`, style: overdueRepairs.length > 0 ? "danger" : "neutral" },
            { label: "Ready for pickup", count: readyForPickup.length, href: `${bp}/repairs?filter=ready`, style: readyForPickup.length > 0 ? "success" : "neutral" },
            { label: "Overdue invoices", count: overdueInvoiceCount, href: `${bp}/invoices?filter=overdue`, style: overdueInvoiceCount > 0 ? "danger" : "neutral" },
            { label: "Low stock", count: lowStockItems.length, href: `${bp}/inventory`, style: lowStockItems.length > 0 ? "warn" : "neutral" },
          ].map((item) => (
            <a
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
            </a>
          ))}
        </div>

        {/* Needs attention */}
        <AnimatePresence>
          {attentionItems.length > 0 && !activeCategory && (
            <motion.section
              key="attention"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">Needs Attention</h2>
                <span className="text-[0.75rem] text-stone-400">{attentionItems.length} item{attentionItems.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] divide-y divide-[#F0EDE9]">
                {attentionItems.map((item) => (
                  <TableRow key={item.key} href={item.href}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[item.dot]}`} />
                    <span className="text-[0.7rem] font-mono text-stone-300 w-[5rem] truncate flex-shrink-0">{item.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] text-stone-800 font-medium truncate">{item.label}</p>
                      {item.sub && <p className="text-[0.75rem] text-stone-400 truncate">{item.sub}</p>}
                    </div>
                    <span className="text-[0.75rem] text-stone-400 flex-shrink-0 hidden sm:block">{item.type}</span>
                    <span className={`text-[0.75rem] font-medium flex-shrink-0 ${item.statusColor}`}>{item.status}</span>
                  </TableRow>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Category grid / drill-down */}
        <AnimatePresence mode="wait">
          {!activeCategory ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
            >
              {SECTIONS.map((section, i) => {
                const { text, alert } = getStatus(section.id);
                return (
                  <motion.button
                    key={section.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.1, delay: i * 0.015 }}
                    onClick={() => setActiveCategory(section.id)}
                    className="group flex flex-col gap-3 bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl p-5 text-left
                      hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:border-stone-300 hover:-translate-y-0.5
                      transition-all duration-200 cursor-pointer"
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-stone-100
                      group-hover:bg-stone-900 transition-colors duration-200 text-stone-500 group-hover:text-white">
                      {section.icon}
                    </div>
                    {/* Title + desc */}
                    <div>
                      <p className="text-[0.9375rem] font-semibold text-stone-900 leading-snug">{section.title}</p>
                      <p className="text-[0.75rem] text-stone-400 mt-0.5 leading-relaxed">{section.description}</p>
                    </div>
                    {/* Status line */}
                    <p className={`text-[0.75rem] font-medium leading-relaxed ${alert ? "text-[#9B7A4A]" : "text-stone-400"}`}>
                      {alert && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C4924A] mr-1.5 mb-px" />}
                      {text}
                    </p>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (() => {
            const section = SECTIONS.find((s) => s.id === activeCategory)!;
            return (
              <motion.section
                key={`drill-${activeCategory}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.1 }}
              >
                {/* Breadcrumb */}
                <div className="flex items-center gap-3 mb-5">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="flex items-center gap-1.5 text-[0.8125rem] text-stone-400 hover:text-stone-900 transition-colors duration-150 cursor-pointer"
                  >
                    {icons.chevronLeft}
                    Dashboard
                  </button>
                  <span className="text-stone-300">/</span>
                  <h2 className="font-serif text-[1.25rem] text-stone-900 font-normal">{section.title}</h2>
                </div>

                {/* Data panel */}
                <ModuleDataPanel
                  sectionId={activeCategory}
                  bp={bp}
                  salesThisMonthCount={salesThisMonthCount}
                  currency={currency}
                  lowStockItems={lowStockItems}
                  overdueRepairs={overdueRepairs}
                  readyForPickup={readyForPickup}
                  activeRepairs={activeRepairs}
                  activeBespokeJobs={activeBespokeJobs}
                  recentSales={recentSales}
                  overdueInvoiceCount={overdueInvoiceCount}
                  totalOutstanding={totalOutstanding}
                  myTasks={myTasks}
                />

                {/* Quick actions */}
                <h3 className="text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-stone-400 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {section.items.map((item, i) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.08, delay: i * 0.012 }}
                    >
                      <ActionCard title={item.title} description={item.description} icon={item.icon} href={item.href} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col gap-4 w-[256px] flex-shrink-0">

        {/* TODAY */}
        <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="px-5 pt-4 pb-3 border-b border-[#E8E4DF]">
            <h3 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">Today</h3>
          </div>
          <div className="px-5 py-4 space-y-5">
            {/* Tasks due */}
            <div>
              <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Tasks due</p>
              {isStatsLoading ? (
                <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
              ) : myTasks.length > 0 ? (
                <div className="space-y-0.5">
                  {myTasks.slice(0, 3).map((task) => (
                    <a key={task.id} href={`${bp}/tasks`}
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === "urgent" ? "bg-red-400" : task.priority === "high" ? "bg-amber-400" : "bg-stone-300"}`} />
                      <span className="text-[0.8rem] text-stone-700 truncate">{task.title}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="text-[0.8rem] text-stone-400">No tasks due today</p>}
            </div>

            {/* Ready for pickup */}
            <div>
              <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Ready for pickup</p>
              {isStatsLoading ? (
                <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
              ) : readyForPickup.length > 0 ? (
                <div className="space-y-0.5">
                  {readyForPickup.slice(0, 4).map((item) => (
                    <a key={`${item.type}-${item.id}`}
                      href={`${bp}/${item.type === "repair" ? "repairs" : "bespoke"}/${item.id}`}
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-[0.8rem] text-stone-700 truncate">{item.label}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="text-[0.8rem] text-stone-400">Nothing ready yet</p>}
            </div>

            {/* Overdue */}
            {overdueRepairs.length > 0 && (
              <div>
                <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Overdue jobs</p>
                <div className="space-y-0.5">
                  {overdueRepairs.slice(0, 3).map((r) => (
                    <a key={r.id} href={`${bp}/repairs/${r.id}`}
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-[0.8rem] text-stone-700 truncate">{r.item}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="px-5 pt-4 pb-3 border-b border-[#E8E4DF]">
            <h3 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">Recent Activity</h3>
          </div>
          <div className="px-5 py-4 space-y-5">
            {/* Recent sales */}
            <div>
              <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Sales</p>
              {isStatsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
              ) : recentSales.length > 0 ? (
                <div className="space-y-0.5">
                  {recentSales.slice(0, 4).map((sale) => (
                    <a key={sale.id} href={`${bp}/sales/${sale.id}`}
                      className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                      <span className="text-[0.7rem] font-mono text-stone-300 tabular-nums w-6 flex-shrink-0">{sale.saleNumber}</span>
                      <span className="text-[0.8rem] text-stone-700 truncate">{sale.customer || "Walk-in"}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="text-[0.8rem] text-stone-400">No recent sales</p>}
            </div>

            {/* Recent repairs */}
            <div>
              <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Repairs</p>
              {isStatsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
              ) : recentRepairsList.length > 0 ? (
                <div className="space-y-0.5">
                  {recentRepairsList.slice(0, 4).map((repair) => (
                    <a key={repair.id} href={`${bp}/repairs/${repair.id}`}
                      className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                      <span className="text-[0.7rem] font-mono text-stone-300 tabular-nums w-6 flex-shrink-0">{repair.repairNumber}</span>
                      <span className="text-[0.8rem] text-stone-700 truncate">{repair.customer || "No customer"}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="text-[0.8rem] text-stone-400">No recent repairs</p>}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
