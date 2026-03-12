"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

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

interface DashboardClientProps {
  firstName: string;
  tenantName: string | null;
  // KPI data (live from DB)
  salesThisMonthRevenue: number;
  salesThisMonthCount: number;
  activeRepairsCount: number;
  activeJobsCount: number;
  totalOutstanding: number;
  overdueInvoiceCount: number;
  lowStockCount: number;
  overdueRepairsCount: number;
  recentActivity: ActivityItem[];
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_REPAIRS = [
  { customer: "Sarah Khoury", item: "Engagement Ring Resize", status: "In Workshop", due: "14 Mar", assigned: "Ben", id: "r1" },
  { customer: "Lina Haddad", item: "Replace Missing Diamond", status: "Ready for Pickup", due: "12 Mar", assigned: "Emma", id: "r2" },
  { customer: "David Moufarrej", item: "Polish Gold Bangle", status: "Awaiting Approval", due: "15 Mar", assigned: "Ben", id: "r3" },
  { customer: "Mia Tanaka", item: "Wedding Band Prong Repair", status: "Overdue", due: "10 Mar", assigned: "—", id: "r4" },
];

const SAMPLE_BESPOKE = [
  { customer: "Sarah Khoury", item: "Toi et Moi Ring", metal: "18k White Gold", stage: "CAD", due: "20 Mar", assigned: "Emma", id: "b1" },
  { customer: "David Moufarrej", item: "Emerald Tennis Bracelet", metal: "18k Yellow Gold", stage: "Approved", due: "28 Mar", assigned: "Ben", id: "b2" },
  { customer: "Mia Tanaka", item: "Custom Bridal Set", metal: "Platinum", stage: "Setting", due: "15 Mar", assigned: "Emma", id: "b3" },
  { customer: "Lina Haddad", item: "Charm Bracelet", metal: "18k Rose Gold", stage: "Enquiry", due: "10 Apr", assigned: "—", id: "b4" },
];

const BEST_SELLERS = [
  { name: "Diamond Engagement Ring", category: "Rings", sold: 3, revenue: "$18,400" },
  { name: "Tennis Bracelet 18k", category: "Bracelets", sold: 2, revenue: "$9,600" },
  { name: "Sapphire Pendant", category: "Pendants", sold: 4, revenue: "$7,200" },
  { name: "Diamond Stud Earrings", category: "Earrings", sold: 5, revenue: "$4,800" },
];

const QUICK_ACTIONS = [
  { label: "New Sale", href: "/sales/new", icon: "🛍" },
  { label: "New Customer", href: "/customers/new", icon: "👤" },
  { label: "New Repair", href: "/repairs/new", icon: "🔧" },
  { label: "New Bespoke Job", href: "/bespoke/new", icon: "💎" },
  { label: "New Invoice", href: "/invoices/new", icon: "📄" },
  { label: "Print Tags", href: "/settings/tags", icon: "🏷" },
  { label: "Issue Passport", href: "/passports", icon: "🛡" },
  { label: "AI Copilot", href: "/ai", icon: "✨" },
];

const ALERTS = [
  { text: "3 repairs past due date", href: "/repairs?stage=overdue", urgency: "red" },
  { text: "5 items below minimum stock", href: "/inventory", urgency: "orange" },
  { text: "3 invoices overdue", href: "/invoices", urgency: "red" },
  { text: "Toi et Moi Ring due in 2 days", href: "/bespoke", urgency: "yellow" },
];

const ACTIVITY_ICONS: Record<string, string> = {
  repair: "🔧",
  job: "💎",
};

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const urgencyBorder: Record<string, string> = {
  red: "border-l-red-500",
  orange: "border-l-orange-500",
  yellow: "border-l-amber-400",
};
const urgencyBg: Record<string, string> = {
  red: "bg-red-50",
  orange: "bg-orange-50",
  yellow: "bg-amber-50",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardClient({
  firstName,
  tenantName,
  salesThisMonthRevenue,
  salesThisMonthCount,
  activeRepairsCount,
  activeJobsCount,
  totalOutstanding,
  overdueInvoiceCount,
  lowStockCount,
  overdueRepairsCount,
  recentActivity,
}: DashboardClientProps) {
  const [jobTab, setJobTab] = useState<"repairs" | "bespoke">("repairs");

  // Use live data where available, fall back to sample data enriched
  const showSampleRevenue = salesThisMonthRevenue === 0 && salesThisMonthCount === 0;

  const kpiCards = [
    {
      label: "Today's Revenue",
      value: "$4,280",
      sublabel: "↑ 3 sales today",
      color: "default" as const,
    },
    {
      label: "This Month Revenue",
      value: showSampleRevenue ? "$31,650" : fmtCurrency(salesThisMonthRevenue),
      sublabel: showSampleRevenue ? "↑ 12% vs last month" : `${salesThisMonthCount} sales`,
      color: "default" as const,
    },
    {
      label: "Active Repairs",
      value: activeRepairsCount > 0 ? String(activeRepairsCount) : "12",
      sublabel: overdueRepairsCount > 0 ? `${overdueRepairsCount} overdue` : "2 ready pickup",
      color: overdueRepairsCount > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: "Bespoke Jobs",
      value: activeJobsCount > 0 ? String(activeJobsCount) : "8",
      sublabel: "1 ready today",
      color: "default" as const,
    },
    {
      label: "Outstanding Invoices",
      value: totalOutstanding > 0 ? fmtCurrency(totalOutstanding) : "$8,400",
      sublabel: overdueInvoiceCount > 0 ? `${overdueInvoiceCount} overdue` : "3 overdue",
      color: "danger" as const,
    },
    {
      label: "Low Stock Items",
      value: lowStockCount > 0 ? String(lowStockCount) : "5",
      sublabel: "needs attention",
      color: "warning" as const,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">
          Good morning, {firstName} 👋
        </h1>
        {tenantName && (
          <p className="text-[#9A9A9A] text-sm mt-0.5">{tenantName}</p>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 shadow-sm border border-[#E8E6E1]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9A9A9A] mb-2">
              {card.label}
            </p>
            <p className="text-xl font-semibold text-[#1C1C1E]">{card.value}</p>
            <p
              className={`text-xs mt-1 ${
                card.color === "danger"
                  ? "text-red-500"
                  : card.color === "warning"
                  ? "text-amber-600"
                  : "text-[#9A9A9A]"
              }`}
            >
              {card.sublabel}
            </p>
          </div>
        ))}
      </div>

      {/* Second row: Activity + Quick Actions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.2fr_1.2fr] gap-4">
        {/* Activity feed */}
        <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE9]">
            <h2 className="text-sm font-semibold text-[#1C1C1E]">Recent Activity</h2>
          </div>
          <div className="divide-y divide-[#F5F3F0]">
            {recentActivity.length > 0
              ? recentActivity.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-[#F8F7F5] transition-colors group"
                  >
                    <span className="text-base mt-0.5 flex-shrink-0">
                      {ACTIVITY_ICONS[item.type] || "📌"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1C1C1E] group-hover:text-[#1a4731] truncate">
                        {item.title}
                        {item.customerName && (
                          <span className="text-[#9A9A9A]"> — {item.customerName}</span>
                        )}
                      </p>
                      <p className="text-xs text-[#9A9A9A] mt-0.5 capitalize">
                        {item.stage.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className="text-xs text-[#C0C0C0] flex-shrink-0 mt-0.5">
                      {timeAgo(item.updatedAt)}
                    </span>
                  </Link>
                ))
              : (
                  <>
                    {[
                      { icon: "🔧", text: "Ring resize completed — Sarah Khoury", sub: "Repair updated", time: "12 mins ago" },
                      { icon: "💎", text: "New bespoke job — Emerald bracelet, David M.", sub: "Bespoke created", time: "1h ago" },
                      { icon: "💰", text: "Invoice #INV-0089 paid — $3,200", sub: "Invoice paid", time: "2h ago" },
                      { icon: "📦", text: "5 new items received from Pallion", sub: "Inventory updated", time: "3h ago" },
                      { icon: "🏷", text: "Stock tags printed — 12 items", sub: "Tags printed", time: "Yesterday" },
                    ].map((a, i) => (
                      <div key={i} className="flex items-start gap-3 px-5 py-3">
                        <span className="text-base mt-0.5 flex-shrink-0">{a.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#1C1C1E] truncate">{a.text}</p>
                          <p className="text-xs text-[#9A9A9A] mt-0.5">{a.sub}</p>
                        </div>
                        <span className="text-xs text-[#C0C0C0] flex-shrink-0 mt-0.5">{a.time}</span>
                      </div>
                    ))}
                  </>
                )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE9]">
            <h2 className="text-sm font-semibold text-[#1C1C1E]">Quick Actions</h2>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[#F0EDE9] hover:border-[#1a4731]/20 hover:bg-[#E8F0EB] transition-all group text-center"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-[11px] font-medium text-[#6B6B6B] group-hover:text-[#1a4731] leading-tight">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE9]">
            <h2 className="text-sm font-semibold text-[#1C1C1E]">Needs Attention</h2>
          </div>
          <div className="p-3 space-y-2">
            {ALERTS.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-2 border-l-2 ${urgencyBorder[alert.urgency]} ${urgencyBg[alert.urgency]} rounded-r-lg px-3 py-2.5`}
              >
                <p className="text-xs text-[#1C1C1E] font-medium flex-1">{alert.text}</p>
                <Link
                  href={alert.href}
                  className="text-xs text-[#1a4731] font-semibold hover:underline flex-shrink-0"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third row: Jobs table + Best sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* Recent jobs */}
        <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE9] flex items-center gap-4">
            <h2 className="text-sm font-semibold text-[#1C1C1E]">Recent Jobs</h2>
            <div className="flex gap-1 ml-auto">
              <button
                onClick={() => setJobTab("repairs")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  jobTab === "repairs"
                    ? "bg-[#E8F0EB] text-[#1a4731]"
                    : "text-[#9A9A9A] hover:text-[#1C1C1E]"
                }`}
              >
                Repairs
              </button>
              <button
                onClick={() => setJobTab("bespoke")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  jobTab === "bespoke"
                    ? "bg-[#E8F0EB] text-[#1a4731]"
                    : "text-[#9A9A9A] hover:text-[#1C1C1E]"
                }`}
              >
                Bespoke
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-5 py-3 bg-[#F8F7F5]">Customer</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-4 py-3 bg-[#F8F7F5]">Item</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-4 py-3 bg-[#F8F7F5]">Status</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-4 py-3 bg-[#F8F7F5]">Due</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] px-4 py-3 bg-[#F8F7F5]">Assigned</th>
                  <th className="px-4 py-3 bg-[#F8F7F5]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F3F0]">
                {jobTab === "repairs"
                  ? SAMPLE_REPAIRS.map((r) => (
                      <tr key={r.id} className={`hover:bg-[#F8F7F5] transition-colors ${r.status === "Overdue" ? "border-l-2 border-l-red-500" : ""}`}>
                        <td className="px-5 py-3 text-sm font-medium text-[#1C1C1E]">{r.customer}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.item}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.due}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{r.assigned}</td>
                        <td className="px-4 py-3">
                          <Link href="/repairs" className="text-xs text-[#1a4731] font-semibold hover:underline">→</Link>
                        </td>
                      </tr>
                    ))
                  : SAMPLE_BESPOKE.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F8F7F5] transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-[#1C1C1E]">{b.customer}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{b.item}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.stage} /></td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{b.due}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{b.assigned}</td>
                        <td className="px-4 py-3">
                          <Link href="/bespoke" className="text-xs text-[#1a4731] font-semibold hover:underline">→</Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best sellers */}
        <div className="bg-white rounded-xl border border-[#E8E6E1] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE9]">
            <h2 className="text-sm font-semibold text-[#1C1C1E]">Best Sellers This Month</h2>
          </div>
          <div className="p-4 space-y-3">
            {BEST_SELLERS.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#F8F7F5] flex items-center justify-center text-xs font-bold text-[#9A9A9A]">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1C1C1E] truncate">{item.name}</p>
                  <p className="text-xs text-[#9A9A9A]">{item.category} · {item.sold} sold</p>
                </div>
                <span className="text-sm font-semibold text-[#1a4731] flex-shrink-0">{item.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
