import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
    const { success: rlSuccess } = await checkRateLimit(`financials-metrics:${ip}`);
    if (!rlSuccess) return Response.json({ error: "Too many requests" }, { status: 429 });

    const supabase = await createClient();
    const _cookies = await (await import("next/headers")).cookies();
    logger.info({ cookieNames: _cookies.getAll().map(c => c.name), reqCookieHeader: req.headers.get("cookie")?.substring(0,50) }, "debug: route cookies");

    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: accept Bearer token when cookies don't reach the Route Handler.
    if (!user) {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (token) {
        const { data } = await supabase.auth.getUser(token);
        user = data.user;
      }
    }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // FIX: create admin client BEFORE querying the users table.
    // Using the anon (RLS) client to query users triggers infinite policy
    // recursion → 500 error → "Failed to load metrics." in the UI.
    const admin = createAdminClient();

    const { data: userData } = await admin
      .from("users")
      .select("tenant_id, tenants(gst_rate)")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return Response.json({ error: "No tenant" }, { status: 403 });

    const tenantId = userData.tenant_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gstRate: number = (userData.tenants as any)?.gst_rate ?? 0.1;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Fetch all metrics in parallel
    const [
      thisMonthSales,
      lastMonthSales,
      thisMonthRefunds,
      outstandingInvoices,
      thisMonthInvoices,
      lastMonthInvoices,
      // Daily revenue last 30 days for chart
      dailySalesRaw,
      dailyRefundsRaw,
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

    // Sales revenue
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

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const s of salesAll) {
      const m = s.payment_method || "other";
      paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (s.total || 0);
    }

    // Build daily chart data for last 30 days
    const dailyMap = new Map<string, { revenue: number; refunds: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyMap.set(key, { revenue: 0, refunds: 0 });
    }
    for (const s of dailySalesRaw.data ?? []) {
      const key = s.sale_date?.split("T")[0] ?? "";
      if (dailyMap.has(key)) { dailyMap.get(key)!.revenue += s.total || 0; }
    }
    for (const r of dailyRefundsRaw.data ?? []) {
      const key = r.created_at?.split("T")[0] ?? "";
      if (dailyMap.has(key)) { dailyMap.get(key)!.refunds += r.total || 0; }
    }
    const chartData = Array.from(dailyMap.entries()).map(([date, vals]) => ({
      date,
      label: new Date(date + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      revenue: vals.revenue,
      refunds: vals.refunds,
    }));

    // Quarterly GST (last 4 quarters) — run all 4 queries in parallel
    const quarterMeta = [3, 2, 1, 0].map((i) => {
      const qDate = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const qStart = new Date(qDate.getFullYear(), Math.floor(qDate.getMonth() / 3) * 3, 1).toISOString();
      const qEnd = new Date(qDate.getFullYear(), Math.floor(qDate.getMonth() / 3) * 3 + 3, 0, 23, 59, 59).toISOString();
      const qLabel = `Q${Math.floor(qDate.getMonth() / 3) + 1} ${qDate.getFullYear()}`;
      return { qStart, qEnd, qLabel };
    });

    const quarterResults = await Promise.all(
      quarterMeta.map(({ qStart, qEnd }) =>
        admin
          .from("sales")
          .select("total")
          .eq("tenant_id", tenantId)
          .in("status", ["paid", "completed"])
          .gte("sale_date", qStart.split("T")[0])
          .lte("sale_date", qEnd.split("T")[0])
      )
    );

    const quarterlyGST = quarterResults.map(({ data: qSales }, idx) => {
      const qRev = (qSales ?? []).reduce((s, r) => s + (r.total || 0), 0);
      return { label: quarterMeta[idx].qLabel, revenue: qRev, gst: qRev * gstRate / (1 + gstRate) };
    });

    const response = Response.json({
      revenueThisMonth,
      revenueLastMonth,
      refundsThisMonth,
      refundCount,
      outstanding,
      outstandingCount,
      gstCollected,
      avgSaleValue,
      salesCount: salesAll.length,
      paymentBreakdown,
      chartData,
      quarterlyGST,
      gstRate,
    });
    return response;
  } catch (err) {
    logger.error("Metrics error:", err);
    return Response.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
