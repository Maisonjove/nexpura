import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const CHECKLIST = [
  { label: "Create your account", done: true },
  { label: "Complete business setup", done: true },
  { label: "Add your first customer", done: false, href: "/customers" },
  { label: "Create a bespoke job", done: false, href: "/bespoke/new" },
  { label: "Issue your first invoice", done: false, href: "/invoices" },
  { label: "Invite a team member", done: false, href: "/settings" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("full_name, tenant_id, tenants(name, plan:subscriptions(plan, status, trial_ends_at))")
    .eq("id", user?.id ?? "")
    .single();

  const firstName = userData?.full_name?.split(" ")[0] || "there";
  const tenantName = (userData?.tenants as { name?: string } | null)?.name;
  const tenantId = userData?.tenant_id;

  const today = new Date().toISOString().split("T")[0];
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Sales this month
  let salesThisMonthRevenue = 0;
  let salesThisMonthCount = 0;
  try {
    const { data: salesData } = await supabase
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId ?? "")
      .gte("created_at", monthStartStr);
    salesThisMonthRevenue = (salesData ?? []).reduce((s, r) => s + (r.total || 0), 0);
    salesThisMonthCount = (salesData ?? []).length;
  } catch {
    // sales table may not exist yet
  }

  // Invoice stats
  const { data: outstandingData } = await supabase
    .from("invoices")
    .select("amount_due")
    .eq("tenant_id", tenantId ?? "")
    .in("status", ["sent", "partially_paid", "overdue"])
    .is("deleted_at", null);

  const totalOutstanding = (outstandingData ?? []).reduce(
    (sum, inv) => sum + (inv.amount_due || 0),
    0
  );

  const { count: overdueInvoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .not("status", "in", '("paid","voided","draft")')
    .lt("due_date", today)
    .is("deleted_at", null);

  const monthStart = new Date();
  monthStart.setDate(1);

  const { data: paidThisMonthData } = await supabase
    .from("payments")
    .select("amount")
    .eq("tenant_id", tenantId ?? "")
    .gte("payment_date", monthStartStr);

  const paidThisMonth = (paidThisMonthData ?? []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  function fmtCurrency(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Active jobs count
  const { count: activeJobsCount } = await supabase
    .from("bespoke_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")');

  // Overdue jobs count
  const { count: overdueJobsCount } = await supabase
    .from("bespoke_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")')
    .lt("due_date", today);

  // Active repairs count
  const { count: activeRepairsCount } = await supabase
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")');

  // Overdue repairs count
  const { count: overdueRepairsCount } = await supabase
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")')
    .lt("due_date", today);

  // Customer count
  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null);

  // Inventory counts
  const { count: totalStockCount } = await supabase
    .from("inventory")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .eq("status", "active")
    .is("deleted_at", null);

  // Low stock count — need to fetch rows to compare quantity vs threshold
  const { data: lowStockItems } = await supabase
    .from("inventory")
    .select("quantity, low_stock_threshold, track_quantity")
    .eq("tenant_id", tenantId ?? "")
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("track_quantity", true);

  const lowStockCount = (lowStockItems ?? []).filter(
    (i) => i.quantity <= (i.low_stock_threshold ?? 1)
  ).length;

  // Recent activity — last 5 items from bespoke jobs + repairs combined
  const { data: recentJobs } = await supabase
    .from("bespoke_jobs")
    .select("id, title, stage, updated_at, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: recentRepairs } = await supabase
    .from("repairs")
    .select("id, item_description, stage, updated_at, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  type ActivityItem = {
    id: string;
    title: string;
    stage: string;
    customerName: string | null;
    updatedAt: string;
    type: "job" | "repair";
    href: string;
  };

  const recentActivity: ActivityItem[] = [
    ...(recentJobs ?? []).map((j) => ({
      id: j.id,
      title: j.title || "Untitled Job",
      stage: j.stage || "enquiry",
      customerName: Array.isArray(j.customers)
        ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
      updatedAt: j.updated_at,
      type: "job" as const,
      href: `/bespoke/${j.id}`,
    })),
    ...(recentRepairs ?? []).map((r) => ({
      id: r.id,
      title: r.item_description || "Repair",
      stage: r.stage || "intake",
      customerName: Array.isArray(r.customers)
        ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
      updatedAt: r.updated_at,
      type: "repair" as const,
      href: `/repairs/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

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

  const STAT_CARDS = [
    {
      label: "Revenue This Month",
      value: fmtCurrency(salesThisMonthRevenue),
      href: "/sales",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      note: salesThisMonthCount > 0 ? `${salesThisMonthCount} sales` : "No sales yet",
      urgent: false,
    },
    {
      label: "Active Jobs",
      value: String(activeJobsCount ?? 0),
      href: "/bespoke",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      note: (activeJobsCount ?? 0) > 0 ? "In progress" : "No active jobs",
      urgent: false,
    },
    {
      label: "Overdue Jobs",
      value: String(overdueJobsCount ?? 0),
      href: "/bespoke",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      note: (overdueJobsCount ?? 0) > 0 ? "Needs attention" : "All on time",
      urgent: (overdueJobsCount ?? 0) > 0,
    },
    {
      label: "Active Repairs",
      value: String(activeRepairsCount ?? 0),
      href: "/repairs",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      note: (activeRepairsCount ?? 0) > 0 ? "In progress" : "No active repairs",
      urgent: false,
    },
    {
      label: "Overdue Repairs",
      value: String(overdueRepairsCount ?? 0),
      href: "/repairs",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      note: (overdueRepairsCount ?? 0) > 0 ? "Needs attention" : "All on time",
      urgent: (overdueRepairsCount ?? 0) > 0,
    },
    {
      label: "Customers",
      value: String(customerCount ?? 0),
      href: "/customers",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      note: (customerCount ?? 0) > 0 ? "Total clients" : "No customers yet",
      urgent: false,
    },
    {
      label: "Outstanding",
      value: fmtCurrency(totalOutstanding),
      href: "/invoices",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      note: (overdueInvoiceCount ?? 0) > 0
        ? `${overdueInvoiceCount} overdue`
        : "Unpaid invoices",
      urgent: (overdueInvoiceCount ?? 0) > 0,
    },
    {
      label: "Paid This Month",
      value: fmtCurrency(paidThisMonth),
      href: "/invoices",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      note: "Payments received",
      urgent: false,
    },
    {
      label: "Stock Items",
      value: String(totalStockCount ?? 0),
      href: "/inventory",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      note: (totalStockCount ?? 0) > 0 ? "Active items" : "No stock yet",
      urgent: false,
    },
    {
      label: "Low Stock",
      value: String(lowStockCount),
      href: "/inventory",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      note: lowStockCount > 0 ? "Needs restocking" : "Stock levels good",
      urgent: lowStockCount > 0,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">
          Welcome back, {firstName} 👋
        </h1>
        {tenantName && (
          <p className="text-forest/60 mt-1">{tenantName}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-platinum p-5 hover:border-sage/40 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-forest/50 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                card.urgent ? "bg-red-50 text-red-500" : "bg-sage/10 text-sage"
              }`}>
                {card.icon}
              </div>
            </div>
            <p className={`font-fraunces text-2xl font-semibold ${
              card.urgent && card.value !== "0" ? "text-red-500" : "text-forest"
            }`}>
              {card.value}
            </p>
            <p className={`text-xs mt-1 ${
              card.urgent && card.value !== "0" ? "text-red-400" : "text-forest/40"
            }`}>
              {card.note}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-fraunces text-lg font-semibold text-forest mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/customers/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Customer
          </Link>
          <Link
            href="/bespoke/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Job
          </Link>
          <Link
            href="/repairs/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Repair
          </Link>
          <Link
            href="/invoices/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </Link>
          <Link
            href="/sales/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Sale
          </Link>
          <Link
            href="/expenses/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-forest/20 text-forest text-sm font-medium rounded-lg hover:bg-ivory transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Expense
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="font-fraunces text-lg font-semibold text-forest mb-3">
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <div className="bg-white rounded-xl border border-platinum p-8 text-center">
            <p className="text-forest/40 text-sm">No activity yet — create your first job or repair to get started.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-platinum divide-y divide-platinum">
            {recentActivity.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-ivory/50 transition-colors group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  item.type === "job" ? "bg-sage/10 text-sage" : "bg-forest/10 text-forest"
                }`}>
                  {item.type === "job" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-forest truncate group-hover:text-sage transition-colors">
                    {item.title}
                  </p>
                  <p className="text-xs text-forest/40 mt-0.5">
                    {item.customerName ? `${item.customerName} · ` : ""}
                    <span className="capitalize">{item.stage.replace(/_/g, " ")}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-forest/30">{timeAgo(item.updatedAt)}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                    item.type === "job" ? "bg-sage/10 text-sage" : "bg-forest/10 text-forest/60"
                  }`}>
                    {item.type}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Getting started checklist */}
      <div className="bg-white rounded-xl border border-platinum p-6">
        <h2 className="font-fraunces text-lg font-semibold text-forest mb-4">
          Getting started
        </h2>
        <div className="space-y-3">
          {CHECKLIST.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done
                    ? "bg-sage"
                    : "border-2 border-platinum"
                }`}
              >
                {item.done && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm ${
                  item.done
                    ? "line-through text-forest/40"
                    : "text-forest"
                }`}
              >
                {item.done || !item.href ? (
                  item.label
                ) : (
                  <a href={item.href} className="hover:text-sage transition-colors">
                    {item.label}
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 h-1.5 bg-platinum rounded-full overflow-hidden">
          <div
            className="h-full bg-sage rounded-full transition-all"
            style={{
              width: `${(CHECKLIST.filter((c) => c.done).length / CHECKLIST.length) * 100}%`,
            }}
          />
        </div>
        <p className="text-xs text-forest/40 mt-2">
          {CHECKLIST.filter((c) => c.done).length} of {CHECKLIST.length} complete
        </p>
      </div>
    </div>
  );
}
