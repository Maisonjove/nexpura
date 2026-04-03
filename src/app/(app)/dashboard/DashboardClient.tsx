"use client";

import { useState, useEffect } from "react";

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
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  jeweller: "Fine Jewellery",
  watchmaker: "Watchmaking",
  goldsmith: "Goldsmithing",
  silversmith: "Silversmithing",
  designer: "Design Studio",
  retailer: "Retail",
  wholesaler: "Wholesale",
};

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

// ─── Icons ──────────────────────────────────────────────────────────────────

const icons = {
  plus: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  cart: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  search: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  box: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  folder: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  userPlus: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  ),
  mail: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  users: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  wrench: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.648 5.648a2.121 2.121 0 01-3-3l5.648-5.648m3-3L19.5 4.5m-8.08 10.67a5.068 5.068 0 01-1.54-3.62c0-1.326.527-2.6 1.46-3.54a5.068 5.068 0 013.54-1.46c1.326 0 2.6.527 3.54 1.46" />
    </svg>
  ),
  sparkles: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  dollar: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  megaphone: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  send: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  globe: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  document: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  plug: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.928-2.879a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.5 8.435m9.928 2.879l-4.5 4.5" />
    </svg>
  ),
  creditCard: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  cog: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function ActionCard({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
    >
      <div className="flex-shrink-0 text-stone-400 group-hover:text-[#8B7355] transition-colors duration-400">
        {icon}
      </div>
      <div>
        <p className="text-[0.9375rem] font-medium text-stone-900">{title}</p>
        <p className="text-[0.8125rem] text-stone-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </a>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardClient({
  basePath = "",
  readOnly = false,
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
}: DashboardClientProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"expanded" | "compact">("expanded");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const d = now || new Date();
  const bp = basePath || "";

  // ── Menu data ──────────────────────────────────────────────────────────────
  const MENU_SECTIONS = [
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
      title: "Stock",
      description: "Inventory, suppliers & transfers",
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
      icon: icons.wrench,
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
        { title: "Templates", description: "Email templates", icon: icons.document, href: `${bp}/marketing/templates` },
      ],
    },
    {
      id: "website",
      title: "Website",
      description: "Builder, connect & migration",
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
        { title: "Payments", description: "Payment settings", icon: icons.creditCard, href: `${bp}/settings/payments` },
        { title: "Locations", description: "Manage locations", icon: icons.globe, href: `${bp}/settings/locations` },
        { title: "Team & Roles", description: "Team management", icon: icons.users, href: `${bp}/settings/roles` },
        { title: "Email Domain", description: "Email configuration", icon: icons.mail, href: `${bp}/settings/email` },
        { title: "Notifications", description: "Notification settings", icon: icons.mail, href: `${bp}/settings/notifications` },
        { title: "Documents", description: "Document management", icon: icons.document, href: `${bp}/documents` },
        { title: "Integrations", description: "Connected services", icon: icons.plug, href: `${bp}/integrations` },
        { title: "Printers", description: "Printer settings", icon: icons.document, href: `${bp}/settings/printing` },
        { title: "Activity Log", description: "View activity", icon: icons.chart, href: `${bp}/settings/activity` },
        { title: "Reminders", description: "Manage reminders", icon: icons.mail, href: `${bp}/settings/reminders` },
        { title: "Tasks", description: "Your task list", icon: icons.clipboard, href: `${bp}/tasks` },
        { title: "AI Copilot", description: "AI assistant", icon: icons.sparkles, href: `${bp}/copilot` },
        { title: "Support", description: "Get help", icon: icons.users, href: `${bp}/support` },
      ],
    },
  ];

  return (
    <div className="flex gap-8 items-start">
      {/* ── Main Column ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-10">
        {/* Business name + date/time */}
        <div className="flex items-start justify-between">
          <div className="flex-1 text-center">
            <h1 className="font-serif text-[2.5rem] tracking-[0.08em] text-stone-900 font-normal leading-[1.08] uppercase">
              {tenantName || "Your Store"}
            </h1>
            {businessType && BUSINESS_TYPE_LABELS[businessType] && (
              <p className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mt-1">
                {BUSINESS_TYPE_LABELS[businessType]}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0 pt-1">
            <p className="text-[0.875rem] font-medium text-stone-900">
              {d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p className="text-[0.875rem] text-stone-400 tabular-nums mt-0.5">
              {d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </p>
          </div>
        </div>

        {/* ── Dev toggle — floating, only in development ─────────────────── */}
        {process.env.NODE_ENV === "development" && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-stone-900 text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-stone-700 overflow-hidden">
              <div className="px-3 py-1.5 bg-stone-800 border-b border-stone-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[0.625rem] font-mono uppercase tracking-wider text-stone-400">Dashboard View</span>
              </div>
              <div className="flex p-1 gap-1">
                <button
                  onClick={() => { setViewMode("expanded"); setActiveCategory(null); }}
                  className={`px-3 py-1.5 rounded-lg text-[0.75rem] font-mono transition-all duration-150 cursor-pointer ${
                    viewMode === "expanded"
                      ? "bg-white text-stone-900"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  Expanded
                </button>
                <button
                  onClick={() => { setViewMode("compact"); setActiveCategory(null); }}
                  className={`px-3 py-1.5 rounded-lg text-[0.75rem] font-mono transition-all duration-150 cursor-pointer ${
                    viewMode === "compact"
                      ? "bg-white text-stone-900"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tasks (if any) ─────────────────────────────────────────────── */}
        {myTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[1.375rem] text-stone-900 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Tasks Due Today
              </h2>
              <a href={`${bp}/tasks`} className="text-[0.8125rem] text-stone-400 hover:text-stone-900 transition-colors duration-200">
                View all →
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTasks.map((task) => (
                <a
                  key={task.id}
                  href={`${bp}/tasks`}
                  className="bg-white border border-stone-200 rounded-2xl px-5 py-4 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    task.priority === "urgent" ? "bg-red-100 text-red-700" :
                    task.priority === "high" ? "bg-amber-100 text-amber-700" :
                    "bg-stone-100 text-stone-600"
                  }`}>
                    {task.priority}
                  </span>
                  <p className="text-[0.875rem] font-medium text-stone-900 mt-2">{task.title}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── EXPANDED VIEW — all sections open ─────────────────────────── */}
        {viewMode === "expanded" && MENU_SECTIONS.map((section) => (
          <section key={section.id}>
            <h2 className="font-serif text-[1.375rem] text-stone-900 mb-4">{section.title} Menu</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {section.items.map((item) => (
                <ActionCard key={item.href} title={item.title} description={item.description} icon={item.icon} href={item.href} />
              ))}
            </div>
          </section>
        ))}

        {/* ── COMPACT VIEW — category cards or drilled-in category ─────── */}
        {viewMode === "compact" && !activeCategory && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MENU_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveCategory(section.id)}
                className="group flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer text-left"
              >
                <div className="flex-shrink-0 text-stone-400 group-hover:text-[#8B7355] transition-colors duration-400">
                  {section.icon}
                </div>
                <div>
                  <p className="text-[0.9375rem] font-medium text-stone-900">{section.title}</p>
                  <p className="text-[0.8125rem] text-stone-400 mt-0.5 leading-relaxed">{section.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {viewMode === "compact" && activeCategory && (() => {
          const section = MENU_SECTIONS.find((s) => s.id === activeCategory)!;
          return (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setActiveCategory(null)}
                  className="flex items-center gap-1.5 text-[0.8125rem] text-stone-400 hover:text-stone-900 transition-colors duration-200 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h2 className="font-serif text-[1.375rem] text-stone-900">{section.title} Menu</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {section.items.map((item) => (
                  <ActionCard key={item.href} title={item.title} description={item.description} icon={item.icon} href={item.href} />
                ))}
              </div>
            </section>
          );
        })()}
      </div>

      {/* ── Right Sidebar — always visible ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col gap-4 w-[280px] flex-shrink-0 pt-16">
        {/* Recent Sales */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h3 className="font-serif text-lg text-stone-900 mb-4">Recent Sales</h3>
          {recentSales.length > 0 ? (
            <div className="space-y-0.5">
              {recentSales.map((sale) => (
                <a
                  key={sale.id}
                  href={`${bp}/sales/${sale.id}`}
                  className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors duration-200"
                >
                  <span className="text-[0.8125rem] font-mono text-stone-400 w-10 tabular-nums">
                    {sale.saleNumber}
                  </span>
                  <span className="text-[0.875rem] text-stone-700">
                    {sale.customer || "Walk-in"}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-stone-400">No sales yet</p>
          )}
        </div>

        {/* Recent Repairs */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h3 className="font-serif text-lg text-stone-900 mb-4">Recent Repairs</h3>
          {recentRepairsList.length > 0 ? (
            <div className="space-y-0.5">
              {recentRepairsList.map((repair) => (
                <a
                  key={repair.id}
                  href={`${bp}/repairs/${repair.id}`}
                  className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors duration-200"
                >
                  <span className="text-[0.8125rem] font-mono text-stone-400 w-10 tabular-nums">
                    {repair.repairNumber}
                  </span>
                  <span className="text-[0.875rem] text-stone-700">
                    {repair.customer || "No customer"}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-stone-400">No repairs yet</p>
          )}
        </div>

        {/* Ready for Pickup */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h3 className="font-serif text-lg text-stone-900 mb-4 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Ready for Pickup
          </h3>
          {readyForPickup.length > 0 ? (
            <div className="space-y-0.5">
              {readyForPickup.map((item) => (
                <a
                  key={`${item.type}-${item.id}`}
                  href={`${bp}/${item.type === "repair" ? "repairs" : "bespoke"}/${item.id}`}
                  className="block py-2.5 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors duration-200"
                >
                  <p className="text-[0.875rem] text-stone-900">{item.label}</p>
                  <p className="text-[0.8125rem] text-stone-400 mt-0.5">
                    {item.number} · {item.customer || "No customer"}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-stone-400">Nothing ready yet</p>
          )}
        </div>
      </aside>
    </div>
  );
}
