import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { planIncludes, PLAN_NAMES, PlanId } from "@/lib/plans";
import ReportsDateClient from "./ReportsDateClient";

export const metadata = { title: "Reports — Nexpura" };

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const ctx = await getEntitlementContext();

  const tenantId = userData?.tenant_id ?? "";

  // Permission check
  let canViewMargins = false;
  if (tenantId) {
    const allowed = await hasPermission(user.id, tenantId, "access_reports");
    if (!allowed) {
      return (
        <div className="max-w-2xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
          <p className="text-stone-500">You don&apos;t have permission to access Reports.</p>
        </div>
      );
    }
    canViewMargins = await hasPermission(user.id, tenantId, "view_margins");
  }

  // Entitlement gate: Full analytics requires Studio or Atelier
  if (!planIncludes(ctx.plan as PlanId, 'fullAnalytics')) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">📈</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Advanced Reporting</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            Your current plan <strong className="text-stone-900">{PLAN_NAMES[ctx.plan as PlanId]}</strong> includes basic dashboard metrics only.
            Upgrade to <strong className="text-stone-900">Studio</strong> or <strong className="text-stone-900">Atelier</strong> to access detailed reports for stock, expenses, and customer trends.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-nexpura-charcoal text-white rounded-xl font-medium text-sm hover:bg-nexpura-charcoal-700 transition-colors"
        >
          Upgrade Plan →
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  // ── Revenue this month & last month (paid invoices) ─────────
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let outstandingAmount = 0;
  let outstandingCount = 0;

  try {
    const [thisMonth, lastMonth, outstanding] = await Promise.all([
      admin
        .from("invoices")
        .select("total")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("created_at", monthStart)
        .is("deleted_at", null),
      admin
        .from("invoices")
        .select("total")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("created_at", prevMonthStart)
        .lte("created_at", prevMonthEnd)
        .is("deleted_at", null),
      admin
        .from("invoices")
        .select("amount_due")
        .eq("tenant_id", tenantId)
        .in("status", ["unpaid", "partial", "overdue", "draft"])
        .is("deleted_at", null),
    ]);
    revenueThisMonth = (thisMonth.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    revenueLastMonth = (lastMonth.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    outstandingAmount = (outstanding.data ?? []).reduce((s, r) => s + (r.amount_due || 0), 0);
    outstandingCount = outstanding.data?.length ?? 0;
  } catch {
    // fall through — tables may not have data yet
  }

  // ── Active repairs & bespoke ─────────────────────────────────
  let activeRepairsCount = 0;
  let activeBespokeCount = 0;
  let newCustomersCount = 0;

  try {
    const [repairs, bespoke, customers] = await Promise.all([
      admin
        .from("repairs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("collected","cancelled")'),
      admin
        .from("bespoke_jobs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("completed","cancelled")'),
      admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", monthStart),
    ]);
    activeRepairsCount = repairs.count ?? 0;
    activeBespokeCount = bespoke.count ?? 0;
    newCustomersCount = customers.count ?? 0;
  } catch {
    // ignore
  }

  // ── Inventory value ──────────────────────────────────────────
  let inventoryValue = 0;
  let lowStockItems: Array<{ id: string; name: string; sku: string | null; quantity: number }> = [];

  try {
    const { data: inventoryData } = await admin
      .from("inventory")
      .select("id, name, sku, quantity, retail_price, low_stock_threshold, track_quantity, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null);

    inventoryValue = (inventoryData ?? []).reduce(
      (s, i) => s + (i.retail_price || 0) * Math.max(i.quantity || 0, 0),
      0
    );
    lowStockItems = (inventoryData ?? [])
      .filter((i) => i.track_quantity && i.quantity <= (i.low_stock_threshold ?? 1))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 20)
      .map((i) => ({ id: i.id, name: i.name, sku: i.sku, quantity: i.quantity }));
  } catch {
    // ignore
  }

  // ── Top customers by invoice value ───────────────────────────
  type TopCustomer = { id: string; full_name: string; email: string | null; total: number; count: number };
  let topCustomers: TopCustomer[] = [];

  try {
    const { data: invoiceData } = await admin
      .from("invoices")
      .select("customer_id, total, customers(id, full_name, email)")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .is("deleted_at", null)
      .not("customer_id", "is", null);

    const map = new Map<string, TopCustomer>();
    for (const inv of invoiceData ?? []) {
      if (!inv.customer_id) continue;
      const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
      if (!cust) continue;
      const existing = map.get(inv.customer_id);
      if (existing) {
        existing.total += inv.total || 0;
        existing.count += 1;
      } else {
        map.set(inv.customer_id, {
          id: inv.customer_id,
          full_name: (cust as { full_name: string }).full_name,
          email: (cust as { email?: string | null }).email ?? null,
          total: inv.total || 0,
          count: 1,
        });
      }
    }
    topCustomers = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  } catch {
    // ignore
  }

  // ── Monthly revenue chart (last 6 months) — single query, grouped in JS ───
  type MonthData = { label: string; revenue: number };
  let monthlyData: MonthData[] = [];

  try {
    // Fetch all paid invoices from last 6 months in one query
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    const { data: monthlyInvoices } = await admin
      .from("invoices")
      .select("total, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", sixMonthsAgo)
      .is("deleted_at", null);

    // Group by month in JS
    const monthMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, 0);
    }

    for (const inv of monthlyInvoices ?? []) {
      if (!inv.created_at) continue;
      const key = inv.created_at.slice(0, 7); // YYYY-MM
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) ?? 0) + (inv.total || 0));
      }
    }

    monthlyData = Array.from(monthMap.entries()).map(([key, revenue]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);
      return {
        label: d.toLocaleString("en-AU", { month: "short" }),
        revenue,
      };
    });
  } catch {
    // ignore
  }

  // ── Recent sales ─────────────────────────────────────────────
  let recentSales: Array<{
    id: string;
    sale_number: string;
    customer_name: string | null;
    total: number;
    status: string;
    created_at: string;
  }> = [];
  let salesCount = 0;

  try {
    const { data: salesData } = await admin
      .from("sales")
      .select("id, sale_number, customer_name, total, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);
    recentSales = salesData ?? [];

    const { count } = await admin
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart);
    salesCount = count ?? 0;
  } catch {
    // sales table may not exist yet
  }

  // ── Chart scaling ────────────────────────────────────────────
  const maxMonthRevenue = Math.max(...monthlyData.map((m) => m.revenue), 1);
  const maxRevenue = Math.max(revenueThisMonth, revenueLastMonth, 1);
  const thisMonthWidth = Math.round((revenueThisMonth / maxRevenue) * 100);
  const lastMonthWidth = Math.round((revenueLastMonth / maxRevenue) * 100);

  const STAT_CARDS = [
    {
      label: "Revenue This Month",
      value: fmtCurrency(revenueThisMonth),
      sub: revenueLastMonth > 0
        ? `${revenueThisMonth >= revenueLastMonth ? "+" : ""}${Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)}% vs last month`
        : undefined,
      href: undefined as string | undefined,
      urgent: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Outstanding Invoices",
      value: fmtCurrency(outstandingAmount),
      sub: `${outstandingCount} invoice${outstandingCount !== 1 ? "s" : ""}`,
      href: "/invoices" as string | undefined,
      urgent: outstandingCount > 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: "Inventory Value",
      value: fmtCurrency(inventoryValue),
      sub: undefined as string | undefined,
      href: "/inventory" as string | undefined,
      urgent: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label: "Sales This Month",
      value: String(salesCount),
      sub: undefined as string | undefined,
      href: "/sales" as string | undefined,
      urgent: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      label: "Active Repairs",
      value: String(activeRepairsCount),
      sub: undefined as string | undefined,
      href: "/repairs" as string | undefined,
      urgent: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Active Bespoke Jobs",
      value: String(activeBespokeCount),
      sub: undefined as string | undefined,
      href: "/bespoke" as string | undefined,
      urgent: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      label: "New Customers",
      value: String(newCustomersCount),
      sub: "this month" as string | undefined,
      href: "/customers" as string | undefined,
      urgent: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Low Stock Items",
      value: String(lowStockItems.length),
      sub: lowStockItems.length > 0 ? "need restocking" : "all healthy" as string | undefined,
      href: "/inventory" as string | undefined,
      urgent: lowStockItems.length > 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  ];

  const STATUS_COLOURS: Record<string, string> = {
    quote: "bg-stone-100 text-stone-700",
    confirmed: "bg-stone-100 text-stone-700",
    paid: "bg-green-50 text-green-700",
    completed: "bg-stone-100 text-amber-700",
    refunded: "bg-red-50 text-red-600",
    layby: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-2xl text-stone-900">Reports & Analytics</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Overview for {now.toLocaleString("en-AU", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Date Range Reports */}
      <ReportsDateClient tenantId={tenantId} canViewMargins={canViewMargins} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const inner = (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {card.label}
                </span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    card.urgent ? "bg-red-50 text-red-500" : "bg-stone-100 text-amber-700"
                  }`}
                >
                  {card.icon}
                </div>
              </div>
              <p className={`font-semibold text-2xl ${card.urgent ? "text-red-500" : "text-stone-900"}`}>
                {card.value}
              </p>
              {card.sub && (
                <p className="text-xs text-stone-400 mt-1">{card.sub}</p>
              )}
            </>
          );
          const cls = `bg-white rounded-xl border border-stone-200 p-5 shadow-sm ${
            card.href ? "hover:border-amber-600/40 transition-all cursor-pointer" : ""
          }`;
          if (card.href) {
            return (
              <Link key={card.label} href={card.href} className={cls}>
                {inner}
              </Link>
            );
          }
          return (
            <div key={card.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Monthly revenue chart (6 months) */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg text-stone-900 mb-5">Revenue — Last 6 Months</h2>
        <div className="space-y-3">
          {monthlyData.map((m) => {
            const pct = Math.round((m.revenue / maxMonthRevenue) * 100);
            const isCurrent = m.label === now.toLocaleString("en-AU", { month: "short" });
            return (
              <div key={m.label} className="flex items-center gap-4">
                <span className={`text-xs w-8 text-right flex-shrink-0 ${isCurrent ? "text-stone-900 font-semibold" : "text-stone-500"}`}>
                  {m.label}
                </span>
                <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-5 rounded-full transition-all duration-500 ${isCurrent ? "bg-amber-700" : "bg-stone-300"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs w-20 text-right flex-shrink-0 font-medium ${isCurrent ? "text-stone-900" : "text-stone-500"}`}>
                  {fmtCurrency(m.revenue)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue comparison (this vs last month) */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg text-stone-900 mb-5">Month-over-Month Revenue</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-stone-500">
                This month ({now.toLocaleString("en-AU", { month: "long" })})
              </span>
              <span className="font-semibold text-stone-900">{fmtCurrency(revenueThisMonth)}</span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-amber-700 rounded-full transition-all duration-500"
                style={{ width: `${thisMonthWidth}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-stone-500">
                Last month ({new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-AU", { month: "long" })})
              </span>
              <span className="font-semibold text-stone-900">{fmtCurrency(revenueLastMonth)}</span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-stone-900/30 rounded-full transition-all duration-500"
                style={{ width: `${lastMonthWidth}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top customers */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Top Customers by Revenue</h2>
            <Link href="/customers" className="text-xs text-amber-700 font-medium hover:underline">
              View all →
            </Link>
          </div>
          {topCustomers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-400">No paid invoices yet</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {topCustomers.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-stone-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-400 w-4">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-stone-900">{c.full_name}</p>
                      <p className="text-xs text-stone-400">{c.count} invoice{c.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-stone-900">{fmtCurrency(c.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Low Stock Items</h2>
            <Link href="/inventory" className="text-xs text-amber-700 font-medium hover:underline">
              View all →
            </Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-400">
              All stock levels are healthy
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {lowStockItems.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-stone-400 font-mono">{item.sku}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center text-sm font-semibold px-2 py-0.5 rounded-full ${
                      item.quantity === 0
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.quantity} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Recent Sales</h2>
          <Link href="/sales" className="text-xs text-amber-700 font-medium hover:underline">
            View all →
          </Link>
        </div>
        {recentSales.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-stone-400">No sales yet</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentSales.map((sale) => (
              <Link
                key={sale.id}
                href={`/sales/${sale.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-stone-50/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900 font-mono">{sale.sale_number}</p>
                  <p className="text-xs text-stone-400">
                    {sale.customer_name || "Walk-in"} ·{" "}
                    {new Date(sale.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      STATUS_COLOURS[sale.status] || "bg-stone-900/10 text-stone-500"
                    }`}
                  >
                    {sale.status}
                  </span>
                  <span className="text-sm font-semibold text-stone-900">
                    {fmtCurrency(sale.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Additional Reports */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-900">More Reports</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
          {[
            { href: "/reports/customers", icon: "👥", title: "Customer Intelligence", desc: "Spend, AOV, frequency, CSV export" },
            { href: "/reports/suppliers", icon: "🏭", title: "Supplier Performance", desc: "Order count, spend, delivery metrics" },
            { href: "/reports/expenses", icon: "💰", title: "Expense Report", desc: "Filter, export expenses by category" },
            { href: "/reports/stock", icon: "📦", title: "Stock Movement", desc: "Stock in, out, and adjustments" },
          ].map((r) => (
            <Link key={r.href} href={r.href} className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors group">
              <span className="text-2xl">{r.icon}</span>
              <div>
                <p className="font-medium text-stone-900 group-hover:text-amber-700 transition-colors text-sm">{r.title}</p>
                <p className="text-xs text-stone-400">{r.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
