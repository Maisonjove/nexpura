import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import logger from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, tenants(name, gst_rate)")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return Response.json({ error: "No tenant" }, { status: 403 });

    const tenantId = userData.tenant_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = userData.tenants as any;
    const gstRate: number = tenant?.gst_rate ?? 0.1;

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) return Response.json({ error: "from and to are required" }, { status: 400 });

    const fromDate = from;
    const toDate = to;
    const fromISO = `${fromDate}T00:00:00.000Z`;
    const toISO = `${toDate}T23:59:59.999Z`;

    const admin = createAdminClient();

    const [salesData, refundsData, invoicesData, repairsData, bespokeData, saleItemsData] = await Promise.all([
      // POS sales
      admin
        .from("sales")
        .select("sale_date, total, payment_method, status, customer_name")
        .eq("tenant_id", tenantId)
        .in("status", ["paid", "completed"])
        .gte("sale_date", fromDate)
        .lte("sale_date", toDate)
        .order("sale_date", { ascending: true }),

      // Refunds
      admin
        .from("refunds")
        .select("created_at, total, refund_method")
        .eq("tenant_id", tenantId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO),

      // Paid invoices
      admin
        .from("invoices")
        .select("total, created_at, customers(full_name)")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .is("deleted_at", null),

      // Repairs completed/collected in period
      admin
        .from("repairs")
        .select("price, stage, created_at, customers(full_name)")
        .eq("tenant_id", tenantId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .is("deleted_at", null),

      // Bespoke jobs
      admin
        .from("bespoke_jobs")
        .select("quoted_price, final_price, stage, created_at, customers(full_name)")
        .eq("tenant_id", tenantId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .is("deleted_at", null),

      // Sale items for top products
      admin
        .from("sale_items")
        .select("name, quantity, price, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO),
    ]);

    const sales = salesData.data ?? [];
    const refunds = refundsData.data ?? [];
    const invoices = invoicesData.data ?? [];
    const repairs = repairsData.data ?? [];
    const bespoke = bespokeData.data ?? [];
    const saleItems = saleItemsData.data ?? [];

    // Revenue by category
    const posSalesRevenue = sales.reduce((s, r) => s + (r.total || 0), 0);
    const invoiceRevenue = invoices.reduce((s, r) => s + (r.total || 0), 0);
    const repairRevenue = repairs.reduce((s, r) => s + (r.price || 0), 0);
    const bespokeRevenue = bespoke.reduce((s, r) => s + (((r as {final_price?: number}).final_price ?? (r as {quoted_price?: number}).quoted_price) || 0), 0);
    const totalRevenue = posSalesRevenue + invoiceRevenue;
    const totalRefunds = refunds.reduce((s, r) => s + (r.total || 0), 0);
    const netRevenue = totalRevenue - totalRefunds;
    const gstCollected = totalRevenue * gstRate / (1 + gstRate);
    const totalTransactions = sales.length + invoices.length;
    const avgSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const s of sales) {
      const m = s.payment_method || "other";
      paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (s.total || 0);
    }

    // Top customers by spend
    const customerMap = new Map<string, number>();
    for (const inv of invoices) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (inv.customers as any)?.full_name || "Walk-in";
      customerMap.set(name, (customerMap.get(name) || 0) + (inv.total || 0));
    }
    for (const s of sales) {
      if (s.customer_name) {
        customerMap.set(s.customer_name, (customerMap.get(s.customer_name) || 0) + (s.total || 0));
      }
    }
    const topCustomers = Array.from(customerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    // Top products
    const productMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of saleItems) {
      const existing = productMap.get(item.name) || { qty: 0, revenue: 0 };
      productMap.set(item.name, {
        qty: existing.qty + (item.quantity || 1),
        revenue: existing.revenue + (item.price || 0) * (item.quantity || 1),
      });
    }
    const topProducts = Array.from(productMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }));

    // Revenue chart data — daily if <= 90 days, weekly if > 90
    const fromMs = new Date(fromDate).getTime();
    const toMs = new Date(toDate).getTime();
    const diffDays = Math.ceil((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
    const useWeekly = diffDays > 90;

    const chartData: { label: string; revenue: number; refunds: number }[] = [];
    if (!useWeekly) {
      // Daily buckets
      const dayMap = new Map<string, { revenue: number; refunds: number }>();
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(fromMs + i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split("T")[0];
        dayMap.set(key, { revenue: 0, refunds: 0 });
      }
      for (const s of sales) {
        const key = s.sale_date?.split("T")[0] ?? "";
        if (dayMap.has(key)) dayMap.get(key)!.revenue += s.total || 0;
      }
      for (const inv of invoices) {
        const key = inv.created_at?.split("T")[0] ?? "";
        if (dayMap.has(key)) dayMap.get(key)!.revenue += inv.total || 0;
      }
      for (const r of refunds) {
        const key = r.created_at?.split("T")[0] ?? "";
        if (dayMap.has(key)) dayMap.get(key)!.refunds += r.total || 0;
      }
      for (const [date, vals] of dayMap.entries()) {
        chartData.push({
          label: new Date(date + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
          revenue: vals.revenue,
          refunds: vals.refunds,
        });
      }
    } else {
      // Weekly buckets
      const weekMap = new Map<string, { revenue: number; refunds: number; label: string }>();
      const getWeekKey = (dateStr: string) => {
        const d = new Date(dateStr + "T12:00:00");
        const mon = new Date(d);
        mon.setDate(d.getDate() - d.getDay() + 1);
        return mon.toISOString().split("T")[0];
      };
      const addToWeek = (dateStr: string, revenue: number, refundAmt: number) => {
        const key = getWeekKey(dateStr);
        if (!weekMap.has(key)) {
          const d = new Date(key + "T12:00:00");
          weekMap.set(key, {
            revenue: 0, refunds: 0,
            label: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
          });
        }
        weekMap.get(key)!.revenue += revenue;
        weekMap.get(key)!.refunds += refundAmt;
      };
      for (const s of sales) addToWeek(s.sale_date?.split("T")[0] ?? fromDate, s.total || 0, 0);
      for (const inv of invoices) addToWeek(inv.created_at?.split("T")[0] ?? fromDate, inv.total || 0, 0);
      for (const r of refunds) addToWeek(r.created_at?.split("T")[0] ?? fromDate, 0, r.total || 0);
      for (const [, vals] of Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        chartData.push({ label: vals.label, revenue: vals.revenue, refunds: vals.refunds });
      }
    }

    return Response.json({
      from: fromDate,
      to: toDate,
      totalRevenue,
      totalRefunds,
      netRevenue,
      gstCollected,
      totalTransactions,
      avgSaleValue,
      revenueByCategory: {
        posSales: posSalesRevenue,
        invoices: invoiceRevenue,
        repairs: repairRevenue,
        bespoke: bespokeRevenue,
      },
      topCustomers,
      topProducts,
      paymentBreakdown,
      chartData,
      useWeekly,
    });
  } catch (err) {
    logger.error("Report error:", err);
    return Response.json({ error: "Failed to load report" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, tenants(name)")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return Response.json({ error: "No tenant" }, { status: 403 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessName = (userData.tenants as any)?.name ?? "your business";

    const body = await req.json();
    const { from, to, reportData } = body;

    const summary = `
Business: ${businessName}
Period: ${from} to ${to}

FINANCIALS:
- Total revenue: $${(reportData.totalRevenue || 0).toFixed(2)}
- Total refunds: $${(reportData.totalRefunds || 0).toFixed(2)}
- Net revenue: $${(reportData.netRevenue || 0).toFixed(2)}
- GST collected: $${(reportData.gstCollected || 0).toFixed(2)}
- Total transactions: ${reportData.totalTransactions || 0}
- Average sale value: $${(reportData.avgSaleValue || 0).toFixed(2)}

Revenue by category:
- POS Sales: $${(reportData.revenueByCategory?.posSales || 0).toFixed(2)}
- Invoices: $${(reportData.revenueByCategory?.invoices || 0).toFixed(2)}
- Repairs: $${(reportData.revenueByCategory?.repairs || 0).toFixed(2)}
- Bespoke: $${(reportData.revenueByCategory?.bespoke || 0).toFixed(2)}

Top customers:
${(reportData.topCustomers || []).map((c: { name: string; total: number }) => `- ${c.name}: $${c.total.toFixed(2)}`).join("\n") || "- No data"}

Payment methods:
${Object.entries(reportData.paymentBreakdown || {}).map(([m, v]) => `- ${m}: $${(v as number).toFixed(2)}`).join("\n") || "- No data"}
`.trim();

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are a financial advisor for a jewellery business. Write a 3-4 sentence plain English summary of the given period's financial performance. Be specific with numbers, highlight what's notable (good or concerning), and end with one actionable recommendation. Keep it concise and professional.`,
      prompt: summary,
    });

    return Response.json({ summary: text });
  } catch (err) {
    logger.error("Report summary error:", err);
    return Response.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
