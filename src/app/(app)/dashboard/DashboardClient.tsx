"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus, Wrench, Gem as GemIcon, ArrowRight } from "lucide-react";

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
  const showSampleRevenue = salesThisMonthRevenue === 0 && salesThisMonthCount === 0;

  // KPIs
  const kpis = [
    { label: "Sales This Month", value: showSampleRevenue ? "$31,650" : fmtCurrency(salesThisMonthRevenue), subtext: showSampleRevenue ? "12 sales" : `${salesThisMonthCount} sales` },
    { label: "Active Repairs", value: activeRepairsCount > 0 ? String(activeRepairsCount) : "12", subtext: overdueRepairsCount > 0 ? `${overdueRepairsCount} overdue` : "2 ready" },
    { label: "Bespoke Jobs", value: activeJobsCount > 0 ? String(activeJobsCount) : "8", subtext: "1 ready today" },
    { label: "Outstanding Invoices", value: totalOutstanding > 0 ? fmtCurrency(totalOutstanding) : "$8,400", subtext: overdueInvoiceCount > 0 ? `${overdueInvoiceCount} overdue` : "3 overdue" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "In Workshop": return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-none">In Workshop</Badge>;
      case "Ready for Pickup": return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none">Ready</Badge>;
      case "Awaiting Approval": return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none">Awaiting</Badge>;
      case "Overdue": return <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-none">Overdue</Badge>;
      default: return <Badge variant="outline" className="text-stone-600 border-stone-200">{status}</Badge>;
    }
  };

  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="space-y-6">
      {/* GREETING SECTION */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Good morning, {firstName}
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          {tenantName || 'Your Store'} · {today}
        </p>
        
        <div className="mt-4 border border-stone-200 rounded-lg bg-white divide-x divide-stone-200 inline-flex shadow-sm">
          <Link href="/sales/new" className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-1.5 font-medium transition-colors">
            <Plus className="w-4 h-4 text-stone-400" /> New Sale
          </Link>
          <Link href="/customers/new" className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-1.5 font-medium transition-colors">
            <UserPlus className="w-4 h-4 text-stone-400" /> New Customer
          </Link>
          <Link href="/repairs/new" className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-1.5 font-medium transition-colors">
            <Wrench className="w-4 h-4 text-stone-400" /> New Repair
          </Link>
          <Link href="/bespoke/new" className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-1.5 font-medium transition-colors">
            <GemIcon className="w-4 h-4 text-stone-400" /> New Job
          </Link>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, i) => (
          <Card key={i} className="p-6 rounded-xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-stone-500">{kpi.label}</span>
            </div>
            <p className="text-3xl font-semibold text-stone-900 mt-2">{kpi.value}</p>
            <p className="text-xs text-stone-400 mt-1">{kpi.subtext}</p>
          </Card>
        ))}
      </div>

      {/* OPERATIONS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (col-span-2) - Active Repairs */}
        <Card className="col-span-1 lg:col-span-2 p-0 border-stone-200 shadow-sm rounded-xl overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white">
            <h2 className="text-sm font-semibold text-stone-800">Active Repairs</h2>
            <Link href="/repairs" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">View all</Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Customer</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Item</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Status</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Due</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Tech</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_REPAIRS.map((r) => (
                <TableRow key={r.id} className="hover:bg-stone-50">
                  <TableCell className="text-sm font-medium text-stone-900">{r.customer}</TableCell>
                  <TableCell className="text-sm text-stone-700">{r.item}</TableCell>
                  <TableCell>{getStatusBadge(r.status)}</TableCell>
                  <TableCell className={`text-sm ${r.status === 'Overdue' ? 'text-red-600 font-medium' : 'text-stone-700'}`}>
                    {r.due}
                  </TableCell>
                  <TableCell className="text-sm text-stone-700">{r.assigned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* RIGHT (col-span-1 flex flex-col gap-4) */}
        <div className="col-span-1 flex flex-col gap-6">
          <Card className="p-6 border-stone-200 shadow-sm rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-stone-800">Bespoke Jobs</h2>
              <Link href="/bespoke" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">View all</Link>
            </div>
            <div className="space-y-4">
              {SAMPLE_BESPOKE.slice(0, 3).map((job) => (
                <div key={job.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{job.item}</p>
                    <p className="text-xs text-stone-500">{job.customer}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-stone-600 bg-stone-50 border-stone-200">{job.stage}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 border-stone-200 shadow-sm rounded-xl flex-1">
            <h2 className="text-sm font-semibold text-stone-800 mb-4">Alerts</h2>
            <div className="space-y-3">
              {ALERTS.map((alert, i) => (
                <div key={i} className={`border-l-2 pl-3 py-1 ${alert.urgency === 'red' ? 'border-red-400' : 'border-amber-400'}`}>
                  <Link href={alert.href} className="text-xs text-stone-700 hover:underline">
                    {alert.text}
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-0 border-stone-200 shadow-sm rounded-xl overflow-hidden">
          <div className="p-6 border-b border-stone-100 bg-white">
            <h2 className="text-sm font-semibold text-stone-800">Best Sellers</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Item</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Category</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400">Sold</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-stone-400 text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BEST_SELLERS.map((item, i) => (
                <TableRow key={i} className="hover:bg-stone-50">
                  <TableCell className="text-sm font-medium text-stone-900">{item.name}</TableCell>
                  <TableCell className="text-sm text-stone-700">{item.category}</TableCell>
                  <TableCell className="text-sm text-stone-700">{item.sold}</TableCell>
                  <TableCell className="text-sm font-medium text-stone-900 text-right">{item.revenue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6 border-stone-200 shadow-sm rounded-xl">
          <h2 className="text-sm font-semibold text-stone-800 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm flex-shrink-0">
                    {ACTIVITY_ICONS[item.type] || "📌"}
                  </div>
                  <div>
                    <p className="text-sm text-stone-700">
                      <span className="font-medium text-stone-900">{item.title}</span> {item.customerName && `— ${item.customerName}`}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">{timeAgo(item.updatedAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              [
                { icon: "🔧", text: "Ring resize completed", customer: "Sarah Khoury", time: "12 mins ago" },
                { icon: "💎", text: "New bespoke job", customer: "David M.", time: "1h ago" },
                { icon: "💰", text: "Invoice #INV-0089 paid", customer: "", time: "2h ago" },
                { icon: "📦", text: "5 new items received", customer: "", time: "3h ago" },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm flex-shrink-0">
                    {a.icon}
                  </div>
                  <div>
                    <p className="text-sm text-stone-700">
                      <span className="font-medium text-stone-900">{a.text}</span> {a.customer && `— ${a.customer}`}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
