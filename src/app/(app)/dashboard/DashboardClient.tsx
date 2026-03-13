"use client";

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
  { customer: "Sarah Khoury", item: "Engagement Ring Resize", status: "In Workshop", due: "14 Mar", id: "r1" },
  { customer: "Lina Haddad", item: "Replace Missing Diamond", status: "Ready for Pickup", due: "12 Mar", id: "r2" },
  { customer: "David Moufarrej", item: "Polish Gold Bangle", status: "Awaiting Approval", due: "15 Mar", id: "r3" },
  { customer: "Mia Tanaka", item: "Wedding Band Prong Repair", status: "Overdue", due: "10 Mar", id: "r4" },
];

const SAMPLE_BESPOKE = [
  { customer: "Sarah Khoury", item: "Toi et Moi Ring", stage: "CAD", due: "20 Mar", id: "b1" },
  { customer: "David Moufarrej", item: "Emerald Tennis Bracelet", stage: "Approved", due: "28 Mar", id: "b2" },
  { customer: "Mia Tanaka", item: "Custom Bridal Set", stage: "Setting", due: "15 Mar", id: "b3" },
];

const ALERTS = [
  { text: "3 repairs past due date", href: "/repairs?stage=overdue", urgency: "red" },
  { text: "5 items below minimum stock", href: "/inventory", urgency: "amber" },
  { text: "3 invoices overdue", href: "/invoices", urgency: "red" },
];

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusClasses(status: string) {
  switch (status) {
    case "In Workshop": return "text-amber-700 bg-amber-50 border border-amber-200";
    case "Ready for Pickup": return "text-emerald-700 bg-emerald-50 border border-emerald-200";
    case "Awaiting Approval": return "text-amber-700 bg-amber-50 border border-amber-200";
    case "Overdue": return "text-red-700 bg-red-50 border border-red-200";
    default: return "text-stone-600 bg-stone-100 border border-stone-200";
  }
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
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Good morning, {firstName}
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          {tenantName || 'Your Store'} · {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {/* Quick actions */}
        <div className="inline-flex mt-4 bg-white border border-stone-200 rounded-lg overflow-hidden shadow-sm">
          {[
            { label: 'New Sale', href: '/sales/new' },
            { label: 'New Customer', href: '/customers/new' },
            { label: 'New Repair', href: '/repairs/new' },
            { label: 'New Job', href: '/bespoke/new' },
          ].map((action, i) => (
            <a
              key={action.label}
              href={action.href}
              className={`px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors ${
                i < 3 ? 'border-r border-stone-200' : ''
              }`}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Sales This Month', value: fmtCurrency(salesThisMonthRevenue), sub: `${salesThisMonthCount} sales` },
          { label: 'Active Repairs', value: String(activeRepairsCount), sub: `${overdueRepairsCount} overdue` },
          { label: 'Bespoke Jobs', value: String(activeJobsCount), sub: 'in production' },
          { label: 'Outstanding', value: fmtCurrency(totalOutstanding), sub: `${overdueInvoiceCount} overdue` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg border border-stone-200 p-6">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">{kpi.label}</p>
            <p className="text-2xl font-semibold text-stone-900 mt-1">{kpi.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Operations Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Repairs Table */}
        <div className="col-span-2 bg-white rounded-lg border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 flex justify-between items-center border-b border-stone-100">
            <span className="text-sm font-semibold text-stone-700">Active Repairs</span>
            <a href="/repairs" className="text-xs text-stone-400 hover:text-[#8B7355] transition-colors">View all →</a>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                {['Customer', 'Item', 'Status', 'Due'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-stone-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_REPAIRS.map((r) => (
                <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-medium text-stone-900">{r.customer}</td>
                  <td className="px-4 py-3.5 text-sm text-stone-700">{r.item}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3.5 text-sm ${r.status === 'Overdue' ? 'text-red-600 font-medium' : 'text-stone-500'}`}>
                    {r.due}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Bespoke jobs */}
          <div className="bg-white rounded-lg border border-stone-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-stone-700">Bespoke Jobs</span>
              <a href="/bespoke" className="text-xs text-stone-400 hover:text-[#8B7355] transition-colors">View all →</a>
            </div>
            <div className="space-y-3">
              {SAMPLE_BESPOKE.map((job) => (
                <div key={job.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{job.item}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{job.customer}</p>
                  </div>
                  <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                    {job.stage}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-lg border border-stone-200 p-6">
            <p className="text-sm font-semibold text-stone-700 mb-4">Alerts</p>
            <div className="space-y-2">
              {ALERTS.map((alert, i) => (
                <a
                  key={i}
                  href={alert.href}
                  className={`block px-3 py-2 rounded-md text-xs text-stone-700 border-l-2 bg-stone-50 hover:bg-stone-100 transition-colors ${
                    alert.urgency === 'red' ? 'border-red-400' : 'border-amber-400'
                  }`}
                >
                  {alert.text}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
