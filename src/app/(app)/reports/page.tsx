import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  // ── Revenue this month (from sales) ─────────────────────────
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let salesCount = 0;
  let recentSales: Array<{
    id: string;
    sale_number: string;
    customer_name: string | null;
    total: number;
    status: string;
    created_at: string;
  }> = [];

  try {
    const { data: thisMonthSales } = await supabase
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart);

    revenueThisMonth = (thisMonthSales ?? []).reduce((s, r) => s + (r.total || 0), 0);
    salesCount = (thisMonthSales ?? []).length;

    const { data: lastMonthSales } = await supabase
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("created_at", prevMonthStart)
      .lte("created_at", prevMonthEnd);

    revenueLastMonth = (lastMonthSales ?? []).reduce((s, r) => s + (r.total || 0), 0);

    const { data: recentSalesData } = await supabase
      .from("sales")
      .select("id, sale_number, customer_name, total, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    recentSales = recentSalesData ?? [];
  } catch {
    // sales table may not exist yet
  }

  // ── Active repairs ───────────────────────────────────────────
  let activeRepairsCount = 0;
  try {
    const { count } = await supabase
      .from("repairs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")');
    activeRepairsCount = count ?? 0;
  } catch {
    // ignore
  }

  // ── Active bespoke jobs ──────────────────────────────────────
  let activeBespokeCount = 0;
  try {
    const { count } = await supabase
      .from("bespoke_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("completed","cancelled")');
    activeBespokeCount = count ?? 0;
  } catch {
    // ignore
  }

  // ── New customers this month ─────────────────────────────────
  let newCustomersCount = 0;
  try {
    const { count } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart);
    newCustomersCount = count ?? 0;
  } catch {
    // ignore
  }

  // ── Low stock items ──────────────────────────────────────────
  let lowStockItems: Array<{
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
  }> = [];

  try {
    const { data: inventoryData } = await supabase
      .from("inventory")
      .select("id, name, sku, quantity")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .lt("quantity", 3)
      .order("quantity", { ascending: true })
      .limit(20);

    lowStockItems = inventoryData ?? [];
  } catch {
    // ignore
  }

  // ── Bar chart ────────────────────────────────────────────────
  const maxRevenue = Math.max(revenueThisMonth, revenueLastMonth, 1);
  const thisMonthWidth = Math.round((revenueThisMonth / maxRevenue) * 100);
  const lastMonthWidth = Math.round((revenueLastMonth / maxRevenue) * 100);

  const STAT_CARDS = [
    {
      label: "Revenue This Month",
      value: fmtCurrency(revenueThisMonth),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Sales This Month",
      value: String(salesCount),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      label: "Active Repairs",
      value: String(activeRepairsCount),
      href: "/repairs",
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
      href: "/bespoke",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      label: "New Customers",
      value: String(newCustomersCount),
      href: "/customers",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Low Stock Items",
      value: String(lowStockItems.length),
      href: "/inventory",
      urgent: lowStockItems.length > 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  ];

  const STATUS_COLOURS: Record<string, string> = {
    quote: "bg-blue-50 text-blue-600",
    confirmed: "bg-purple-50 text-purple-600",
    paid: "bg-green-50 text-green-700",
    completed: "bg-sage/10 text-sage",
    refunded: "bg-red-50 text-red-600",
    layby: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Reports & Analytics</h1>
        <p className="text-forest/50 mt-1 text-sm">
          Overview for {now.toLocaleString("en-AU", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS.map((card) => {
          const CardWrapper = card.href ? Link : "div";
          return (
            <CardWrapper
              key={card.label}
              href={(card as { href?: string }).href ?? "#"}
              className={`bg-white rounded-xl border border-platinum p-5 shadow-sm ${
                card.href ? "hover:border-sage/40 hover:shadow-sm transition-all" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-forest/50 uppercase tracking-wider">
                  {card.label}
                </span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    (card as { urgent?: boolean }).urgent
                      ? "bg-red-50 text-red-500"
                      : "bg-sage/10 text-sage"
                  }`}
                >
                  {card.icon}
                </div>
              </div>
              <p
                className={`font-fraunces text-2xl font-semibold ${
                  (card as { urgent?: boolean }).urgent ? "text-red-500" : "text-forest"
                }`}
              >
                {card.value}
              </p>
            </CardWrapper>
          );
        })}
      </div>

      {/* Revenue bar chart */}
      <div className="bg-white border border-platinum rounded-xl p-6 shadow-sm">
        <h2 className="font-fraunces text-lg font-semibold text-forest mb-5">Revenue Comparison</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-forest/60">
                This month ({now.toLocaleString("en-AU", { month: "long" })})
              </span>
              <span className="font-semibold text-forest">{fmtCurrency(revenueThisMonth)}</span>
            </div>
            <div className="w-full bg-platinum rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-sage rounded-full transition-all duration-500"
                style={{ width: `${thisMonthWidth}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-forest/60">
                Last month (
                {new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-AU", {
                  month: "long",
                })}
                )
              </span>
              <span className="font-semibold text-forest">{fmtCurrency(revenueLastMonth)}</span>
            </div>
            <div className="w-full bg-platinum rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-forest/30 rounded-full transition-all duration-500"
                style={{ width: `${lastMonthWidth}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock */}
        <div className="bg-white border border-platinum rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-platinum flex items-center justify-between">
            <h2 className="font-fraunces text-base font-semibold text-forest">Low Stock Items</h2>
            <Link href="/inventory" className="text-xs text-sage font-medium hover:underline">
              View all →
            </Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-forest/40">
              All stock levels are healthy
            </div>
          ) : (
            <div className="divide-y divide-platinum">
              {lowStockItems.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-forest">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-forest/40 font-mono">{item.sku}</p>
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

        {/* Recent sales */}
        <div className="bg-white border border-platinum rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-platinum flex items-center justify-between">
            <h2 className="font-fraunces text-base font-semibold text-forest">Recent Sales</h2>
            <Link href="/sales" className="text-xs text-sage font-medium hover:underline">
              View all →
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-forest/40">No sales yet</div>
          ) : (
            <div className="divide-y divide-platinum">
              {recentSales.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/sales/${sale.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-ivory/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-forest font-mono">{sale.sale_number}</p>
                    <p className="text-xs text-forest/40">
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
                        STATUS_COLOURS[sale.status] || "bg-forest/10 text-forest/60"
                      }`}
                    >
                      {sale.status}
                    </span>
                    <span className="text-sm font-semibold text-forest">
                      {fmtCurrency(sale.total)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
