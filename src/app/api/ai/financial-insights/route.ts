import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const maxDuration = 60;

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
    const businessName: string = tenant?.name ?? "your business";

    const admin = createAdminClient();
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch last 60 days of financial data in parallel
    const [salesData, refundsData, invoicesData, topCustomersData, topProductsData, repairsData, bespokeData] = await Promise.all([
      // Sales by day (last 60 days)
      admin
        .from("sales")
        .select("sale_date, total, payment_method, status")
        .eq("tenant_id", tenantId)
        .gte("sale_date", sixtyDaysAgo)
        .in("status", ["paid", "completed"])
        .order("sale_date", { ascending: true }),

      // Refunds last 60 days
      admin
        .from("refunds")
        .select("created_at, total, refund_method")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixtyDaysAgo),

      // Outstanding invoices
      admin
        .from("invoices")
        .select("total, amount_due, status, created_at")
        .eq("tenant_id", tenantId)
        .in("status", ["sent", "overdue", "partially_paid", "draft"])
        .is("deleted_at", null),

      // Top customers by spend last 60 days
      admin
        .from("invoices")
        .select("total, customers(full_name)")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("created_at", sixtyDaysAgo)
        .is("deleted_at", null)
        .not("customer_id", "is", null),

      // Top selling inventory items (via sale_items if available, else skip)
      admin
        .from("sale_items")
        .select("name, quantity, price")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixtyDaysAgo)
        .order("price", { ascending: false })
        .limit(20),

      // Repairs revenue
      admin
        .from("repairs")
        .select("price, stage, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixtyDaysAgo)
        .is("deleted_at", null),

      // Bespoke revenue
      admin
        .from("bespoke_jobs")
        .select("total_price, stage, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixtyDaysAgo)
        .is("deleted_at", null),
    ]);

    // Process sales totals by week
    const sales = salesData.data ?? [];
    const refunds = refundsData.data ?? [];
    const invoices = invoicesData.data ?? [];

    const totalRevenue60d = sales.reduce((s, r) => s + (r.total || 0), 0);
    const totalRefunds60d = refunds.reduce((s, r) => s + (r.total || 0), 0);
    const totalOutstanding = invoices.reduce((s, r) => s + (r.amount_due || 0), 0);
    const overdueInvoices = invoices.filter((i) => i.status === "overdue");
    const totalOverdue = overdueInvoices.reduce((s, r) => s + (r.amount_due || 0), 0);

    // Last 30 days vs prior 30 days
    const recentSales = sales.filter((s) => s.sale_date >= thirtyDaysAgo);
    const priorSales = sales.filter((s) => s.sale_date < thirtyDaysAgo);
    const revenueRecent30d = recentSales.reduce((s, r) => s + (r.total || 0), 0);
    const revenuePrior30d = priorSales.reduce((s, r) => s + (r.total || 0), 0);

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const s of recentSales) {
      const method = s.payment_method || "unknown";
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (s.total || 0);
    }

    // Refund rate
    const refundRate = totalRevenue60d > 0 ? ((totalRefunds60d / totalRevenue60d) * 100).toFixed(1) : "0";

    // Top customers
    const customerMap = new Map<string, number>();
    for (const inv of topCustomersData.data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (inv.customers as any)?.full_name || "Unknown";
      customerMap.set(name, (customerMap.get(name) || 0) + (inv.total || 0));
    }
    const topCustomers = Array.from(customerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Repairs & bespoke
    const repairRevenue = (repairsData.data ?? []).reduce((s, r) => s + (r.price || 0), 0);
    const bespokeRevenue = (bespokeData.data ?? []).reduce((s, r) => s + (r.total_price || 0), 0);

    // Top products
    const productMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of topProductsData.data ?? []) {
      const existing = productMap.get(item.name) || { qty: 0, revenue: 0 };
      productMap.set(item.name, {
        qty: existing.qty + (item.quantity || 1),
        revenue: existing.revenue + (item.price || 0) * (item.quantity || 1),
      });
    }
    const topProducts = Array.from(productMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    // Build data summary text
    const summary = `
FINANCIAL DATA SUMMARY FOR ${businessName.toUpperCase()} (Last 60 Days)

REVENUE:
- Total revenue last 60 days: $${totalRevenue60d.toFixed(2)}
- Revenue last 30 days: $${revenueRecent30d.toFixed(2)}
- Revenue prior 30 days (days 31-60): $${revenuePrior30d.toFixed(2)}
- Trend: ${revenueRecent30d >= revenuePrior30d ? "+" : ""}${revenuePrior30d > 0 ? ((revenueRecent30d - revenuePrior30d) / revenuePrior30d * 100).toFixed(1) + "%" : "no prior data"}

REFUNDS:
- Total refunds last 60 days: $${totalRefunds60d.toFixed(2)}
- Refund rate: ${refundRate}% of revenue
- Refund count: ${refunds.length}

PAYMENT METHODS (last 30 days):
${Object.entries(paymentBreakdown).map(([m, v]) => `- ${m}: $${v.toFixed(2)}`).join("\n") || "- No data"}

OUTSTANDING INVOICES:
- Total outstanding: $${totalOutstanding.toFixed(2)} (${invoices.length} invoices)
- Overdue: $${totalOverdue.toFixed(2)} (${overdueInvoices.length} invoices)

GST:
- Estimated GST collected (last 30 days): $${(revenueRecent30d * gstRate / (1 + gstRate)).toFixed(2)} (${(gstRate * 100).toFixed(0)}% rate, tax-inclusive)

SERVICE REVENUE:
- Repairs revenue last 60 days: $${repairRevenue.toFixed(2)}
- Bespoke jobs revenue last 60 days: $${bespokeRevenue.toFixed(2)}

TOP CUSTOMERS BY SPEND (last 60 days):
${topCustomers.map(([name, total]) => `- ${name}: $${total.toFixed(2)}`).join("\n") || "- No data"}

TOP PRODUCTS BY REVENUE (last 60 days):
${topProducts.map(([name, d]) => `- ${name}: $${d.revenue.toFixed(2)} (${d.qty} units)`).join("\n") || "- No data"}
`.trim();

    // Call OpenAI for insights
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are a financial advisor for a jewellery business. Analyse the data provided and give 4-6 clear, actionable insights in plain English. Be specific with numbers. Highlight what's going well and what needs attention. Each insight should start with either "✅" (positive trend), "⚠️" (warning/attention needed), or "💡" (general insight/recommendation). Return ONLY a JSON array of strings, one per insight. No markdown, no extra text outside the array.`,
      prompt: summary,
    });

    let insights: string[] = [];
    try {
      // Try to parse as JSON array
      const cleaned = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      insights = JSON.parse(cleaned);
      if (!Array.isArray(insights)) insights = [cleaned];
    } catch {
      // Fall back to splitting by newlines
      insights = text.split("\n").filter((l) => l.trim().length > 0 && (l.includes("✅") || l.includes("⚠️") || l.includes("💡")));
      if (insights.length === 0) insights = [text];
    }

    return Response.json({ insights, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Financial insights error:", err);
    return Response.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
