import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { canUseFeature, planDisplayName } from "@/lib/features";
import Link from "next/link";
import FinancialsClient from "./FinancialsClient";
import type { MetricsData } from "./components/types";

export const metadata = { title: "Financials — Nexpura" };

async function fetchMetrics(tenantId: string, gstRate: number): Promise<MetricsData | null> {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const [
      thisMonthSales, lastMonthSales, thisMonthRefunds, outstandingInvoices,
      thisMonthInvoices, lastMonthInvoices, dailySalesRaw, dailyRefundsRaw,
    ] = await Promise.all([
      admin.from("sales").select("total, payment_method").eq("tenant_id", tenantId).in("status", ["paid", "completed"]).gte("sale_date", monthStart),
      admin.from("sales").select("total").eq("tenant_id", tenantId).in("status", ["paid", "completed"]).gte("sale_date", prevMonthStart).lte("sale_date", prevMonthEnd),
      admin.from("refunds").select("total, refund_method").eq("tenant_id", tenantId).gte("created_at", monthStart),
      admin.from("invoices").select("amount_due, status").eq("tenant_id", tenantId).in("status", ["sent", "overdue", "partially_paid", "draft"]).is("deleted_at", null),
      admin.from("invoices").select("total").eq("tenant_id", tenantId).eq("status", "paid").gte("created_at", monthStart).is("deleted_at", null),
      admin.from("invoices").select("total").eq("tenant_id", tenantId).eq("status", "paid").gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd).is("deleted_at", null),
      admin.from("sales").select("sale_date, total").eq("tenant_id", tenantId).in("status", ["paid", "completed"]).gte("sale_date", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).order("sale_date", { ascending: true }),
      admin.from("refunds").select("created_at, total").eq("tenant_id", tenantId).gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const salesRevThisMonth = (thisMonthSales.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    const salesRevLastMonth = (lastMonthSales.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    const invoiceRevThisMonth = (thisMonthInvoices.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    const invoiceRevLastMonth = (lastMonthInvoices.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    const revenueThisMonth = salesRevThisMonth + invoiceRevThisMonth;
    const revenueLastMonth = salesRevLastMonth + invoiceRevLastMonth;
    const refundsThisMonth = (thisMonthRefunds.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
    const refundCount = thisMonthRefunds.data?.length ?? 0;
    const outstanding = (outstandingInvoices.data ?? []).reduce((s, r) => s + (r.amount_due || 0), 0);
    const outstandingCount = outstandingInvoices.data?.length ?? 0;
    const gstCollected = revenueThisMonth * gstRate / (1 + gstRate);
    const salesAll = thisMonthSales.data ?? [];
    const avgSaleValue = salesAll.length > 0 ? salesRevThisMonth / salesAll.length : 0;
    const paymentBreakdown: Record<string, number> = {};
    for (const s of salesAll) {
      const m = s.payment_method || "other";
      paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (s.total || 0);
    }

    const dailyMap = new Map<string, { revenue: number; refunds: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().split("T")[0], { revenue: 0, refunds: 0 });
    }
    for (const s of dailySalesRaw.data ?? []) {
      const key = s.sale_date?.split("T")[0] ?? "";
      if (dailyMap.has(key)) dailyMap.get(key)!.revenue += s.total || 0;
    }
    for (const r of dailyRefundsRaw.data ?? []) {
      const key = r.created_at?.split("T")[0] ?? "";
      if (dailyMap.has(key)) dailyMap.get(key)!.refunds += r.total || 0;
    }
    const chartData = Array.from(dailyMap.entries()).map(([date, vals]) => ({
      date, label: new Date(date + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      revenue: vals.revenue, refunds: vals.refunds,
    }));

    const quarterMeta = [3, 2, 1, 0].map((i) => {
      const qDate = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const qStart = new Date(qDate.getFullYear(), Math.floor(qDate.getMonth() / 3) * 3, 1).toISOString();
      const qEnd = new Date(qDate.getFullYear(), Math.floor(qDate.getMonth() / 3) * 3 + 3, 0, 23, 59, 59).toISOString();
      return { qStart, qEnd, qLabel: `Q${Math.floor(qDate.getMonth() / 3) + 1} ${qDate.getFullYear()}` };
    });
    const quarterResults = await Promise.all(quarterMeta.map(({ qStart, qEnd }) =>
      admin.from("sales").select("total").eq("tenant_id", tenantId).in("status", ["paid", "completed"])
        .gte("sale_date", qStart.split("T")[0]).lte("sale_date", qEnd.split("T")[0])
    ));
    const quarterlyGST = quarterResults.map(({ data: qSales }, idx) => {
      const qRev = (qSales ?? []).reduce((s, r) => s + (r.total || 0), 0);
      return { label: quarterMeta[idx].qLabel, revenue: qRev, gst: qRev * gstRate / (1 + gstRate) };
    });

    return {
      revenueThisMonth, revenueLastMonth, refundsThisMonth, refundCount,
      outstanding, outstandingCount, gstCollected, avgSaleValue,
      salesCount: salesAll.length, paymentBreakdown, chartData, quarterlyGST, gstRate,
    };
  } catch {
    return null;
  }
}

export default async function FinancialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/onboarding");

  if (!canUseFeature(ctx.plan, "analytics")) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">📊</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Advanced Financials</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            Your current plan <strong className="text-stone-900">{planDisplayName(ctx.plan)}</strong> includes basic dashboard metrics only. Upgrade to <strong className="text-stone-900">Studio</strong> or <strong className="text-stone-900">Atelier</strong> to access deep financial insights, revenue charts, and tax reporting.
          </p>
        </div>
        <Link href="/billing" className="inline-flex items-center gap-2 px-6 py-3 bg-nexpura-charcoal text-white rounded-xl font-medium text-sm hover:bg-nexpura-charcoal-700 transition-colors">
          Upgrade Plan →
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, tenants(name, gst_rate, currency)")
    .eq("id", user.id)
    .single();

  const tenant = userData?.tenants as { name?: string; gst_rate?: number; currency?: string } | null;
  const gstRate = tenant?.gst_rate ?? 0.1;

  // Fetch metrics server-side — bypasses client-side cookie/auth issues entirely.
  const initialMetrics = await fetchMetrics(ctx.tenantId, gstRate);

  return (
    <FinancialsClient
      tenantId={ctx.tenantId}
      businessName={tenant?.name ?? "Your Business"}
      gstRate={gstRate}
      currency={tenant?.currency ?? "AUD"}
      initialMetrics={initialMetrics}
    />
  );
}
