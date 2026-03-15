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

interface DashboardClientProps {
  firstName: string;
  tenantName: string | null;
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
  activeRepairs: ActiveRepair[];
  activeBespokeJobs: ActiveBespokeJob[];
  currency: string;
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStageBadgeClasses(stage: string) {
  switch (stage) {
    case "in_progress": return "text-blue-700 bg-blue-50 border border-blue-200";
    case "ready": return "text-emerald-700 bg-emerald-50 border border-emerald-200";
    case "quoted":
    case "assessed": return "text-amber-700 bg-amber-50 border border-amber-200";
    case "intake": return "text-stone-600 bg-stone-100 border border-stone-200";
    default: return "text-stone-600 bg-stone-100 border border-stone-200";
  }
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
  lowStockItems,
  overdueRepairs,
  readyForPickup,
  recentActivity,
  myTasks,
  activeRepairs,
  activeBespokeJobs,
  currency,
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

      {/* ── Tasks Due Today ──────────────────────────────────────────────────── */}
      {myTasks.length > 0 ? (
        <div className="bg-[#FAF9F6] border border-[#8B7355]/20 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-stone-800 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8B7355] animate-pulse" />
              Tasks Due Today ({myTasks.length})
            </h2>
            <a href="/tasks" className="text-xs font-medium text-[#8B7355] hover:underline">View all tasks →</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTasks.map(task => (
              <div key={task.id} className="bg-white border border-stone-200 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      task.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{task.title}</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <a href={`/tasks`} className="text-[11px] font-medium text-stone-400 hover:text-[#8B7355]">Update →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700">No tasks due today</p>
            <a href="/tasks" className="text-xs text-[#8B7355] hover:underline">View all tasks →</a>
          </div>
        </div>
      )}

      {/* ── KPI Grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Sales This Month', value: fmtCurrency(salesThisMonthRevenue, currency), sub: `${salesThisMonthCount} sale${salesThisMonthCount !== 1 ? 's' : ''}` },
          { label: 'Active Repairs', value: String(activeRepairsCount), sub: overdueRepairs.length > 0 ? `${overdueRepairs.length} overdue` : 'all on track', alert: overdueRepairs.length > 0 },
          { label: 'Bespoke Jobs', value: String(activeJobsCount), sub: 'in production' },
          { label: 'Outstanding', value: fmtCurrency(totalOutstanding, currency), sub: `${overdueInvoiceCount} overdue`, alert: overdueInvoiceCount > 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg border border-stone-200 p-6">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">{kpi.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${(kpi as { alert?: boolean }).alert ? 'text-red-600' : 'text-stone-900'}`}>{kpi.value}</p>
            <p className={`text-xs mt-0.5 ${(kpi as { alert?: boolean }).alert ? 'text-red-400' : 'text-stone-400'}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Ready for Pickup ─────────────────────────────────────────────────── */}
      {readyForPickup.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Ready for Customer Pickup ({readyForPickup.length})
            </h2>
          </div>
          <div className="space-y-2">
            {readyForPickup.map((item) => (
              <a
                key={`${item.type}-${item.id}`}
                href={`/${item.type === 'repair' ? 'repairs' : 'bespoke'}/${item.id}`}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-emerald-100 hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    {item.type === 'repair' ? 'Repair' : 'Bespoke'}
                  </span>
                  <span className="text-sm font-mono text-stone-600">{item.number}</span>
                  <span className="text-sm text-stone-800 font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-500">{item.customer || 'No customer'}</span>
                  <span className="text-xs text-emerald-600 font-semibold">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Operations Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Repairs Table */}
        <div className="col-span-2 bg-white rounded-lg border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 flex justify-between items-center border-b border-stone-100">
            <span className="text-sm font-semibold text-stone-700">Active Repairs</span>
            <a href="/repairs" className="text-xs text-stone-400 hover:text-[#8B7355] transition-colors">View all →</a>
          </div>
          {activeRepairs.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-stone-400">No active repairs yet</p>
              <a href="/repairs/new" className="mt-2 inline-block text-sm font-medium text-[#8B7355] hover:underline">
                Log your first repair →
              </a>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  {['Customer', 'Item', 'Status', 'Due'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-stone-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRepairs.map((r) => {
                  const isOverdue = r.due_date && new Date(r.due_date) < new Date();
                  return (
                    <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/repairs/${r.id}`}>
                      <td className="px-4 py-3.5 text-sm font-medium text-stone-900">{r.customer || "Unknown"}</td>
                      <td className="px-4 py-3.5 text-sm text-stone-700">{r.item}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStageBadgeClasses(r.stage)}`}>
                          {formatStageLabel(r.stage)}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-stone-500'}`}>
                        {r.due_date ? new Date(r.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Bespoke jobs */}
          <div className="bg-white rounded-lg border border-stone-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-stone-700">Bespoke Jobs</span>
              <a href="/bespoke" className="text-xs text-stone-400 hover:text-[#8B7355] transition-colors">View all →</a>
            </div>
            {activeBespokeJobs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-stone-400">No bespoke jobs yet</p>
                <a href="/bespoke/new" className="mt-1 inline-block text-sm font-medium text-[#8B7355] hover:underline">
                  Create first job →
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {activeBespokeJobs.map((job) => (
                  <a key={job.id} href={`/bespoke/${job.id}`} className="flex justify-between items-center hover:bg-stone-50 rounded-md -mx-1 px-1 py-0.5 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{job.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{job.customer || "No customer"}</p>
                    </div>
                    <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                      {formatStageLabel(job.stage)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-lg border border-stone-200 p-6">
            <p className="text-sm font-semibold text-stone-700 mb-4">Alerts</p>
            {overdueRepairs.length === 0 && overdueInvoiceCount === 0 && lowStockItems.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-2">All clear — no alerts 🎉</p>
            ) : (
              <div className="space-y-2">
                {/* Overdue repairs — with details */}
                {overdueRepairs.map((r) => (
                  <a
                    key={r.id}
                    href={`/repairs/${r.id}`}
                    className="block px-3 py-2 rounded-md text-xs border-l-2 border-red-400 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <span className="font-semibold text-red-700">REP-{r.repairNumber}</span>
                    <span className="text-red-600"> · {r.customer || 'No customer'} · {r.daysOverdue}d overdue</span>
                  </a>
                ))}
                {/* Overdue invoices count */}
                {overdueInvoiceCount > 0 && (
                  <a
                    href="/invoices?status=overdue"
                    className="block px-3 py-2 rounded-md text-xs border-l-2 border-red-400 bg-red-50 hover:bg-red-100 transition-colors text-red-700"
                  >
                    {overdueInvoiceCount} invoice{overdueInvoiceCount !== 1 ? 's' : ''} overdue
                  </a>
                )}
                {/* Low stock — with names */}
                {lowStockItems.map((item) => (
                  <a
                    key={item.id}
                    href={`/inventory/${item.id}`}
                    className="block px-3 py-2 rounded-md text-xs border-l-2 border-amber-400 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <span className="font-semibold text-amber-700">{item.name}</span>
                    {item.sku && <span className="text-amber-600"> ({item.sku})</span>}
                    <span className="text-amber-600"> · {item.quantity} left</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
