import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const _ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: _rlSuccess } = await checkRateLimit(_ip);
  if (!_rlSuccess) {
    return new Response("Too many requests", { status: 429 });
  }

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

    const body = await req.json();
    const { messages } = body as { messages: { role: "user" | "assistant"; content: string }[] };

    const admin = createAdminClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch relevant data for context
    const [salesData, refundsData, invoicesData, topCustomersData, inventoryData] = await Promise.all([
      admin
        .from("sales")
        .select("sale_date, total, payment_method, status, customer_name")
        .eq("tenant_id", tenantId)
        .gte("sale_date", sixtyDaysAgo)
        .in("status", ["paid", "completed"])
        .order("sale_date", { ascending: false })
        .limit(100),

      admin
        .from("refunds")
        .select("created_at, total, refund_method, customer_name")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixtyDaysAgo),

      admin
        .from("invoices")
        .select("total, amount_due, status, created_at, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .gte("created_at", sixtyDaysAgo)
        .limit(50),

      admin
        .from("invoices")
        .select("total, customers(full_name)")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .is("deleted_at", null)
        .gte("created_at", sixtyDaysAgo)
        .not("customer_id", "is", null),

      admin
        .from("inventory")
        .select("name, quantity, retail_price, low_stock_threshold, track_quantity")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("retail_price", { ascending: false })
        .limit(20),
    ]);

    const sales = salesData.data ?? [];
    const refunds = refundsData.data ?? [];
    const invoices = invoicesData.data ?? [];

    const totalRevenue60d = sales.reduce((s, r) => s + (r.total || 0), 0);
    const thisMonthSales = sales.filter((s) => s.sale_date >= monthStart);
    const revenueThisMonth = thisMonthSales.reduce((s, r) => s + (r.total || 0), 0);
    const totalRefunds60d = refunds.reduce((s, r) => s + (r.total || 0), 0);
    const outstandingInvoices = invoices.filter((i) => ["sent", "overdue", "partially_paid"].includes(i.status));
    const totalOutstanding = outstandingInvoices.reduce((s, r) => s + (r.amount_due || 0), 0);
    const gstCollected = revenueThisMonth * gstRate / (1 + gstRate);

    // Payment breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const s of sales) {
      const m = s.payment_method || "unknown";
      paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (s.total || 0);
    }

    // Top customers
    const customerMap = new Map<string, number>();
    for (const inv of topCustomersData.data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (inv.customers as any)?.full_name || "Unknown";
      customerMap.set(name, (customerMap.get(name) || 0) + (inv.total || 0));
    }
    const topCustomers = Array.from(customerMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const systemPrompt = `You are a financial assistant for ${businessName}, a jewellery business using Nexpura POS.

## Live Financial Data (last 60 days)
- Revenue this month: $${revenueThisMonth.toFixed(2)}
- Total revenue (60 days): $${totalRevenue60d.toFixed(2)}
- Total refunds (60 days): $${totalRefunds60d.toFixed(2)} (${sales.length} transactions)
- Outstanding invoices: $${totalOutstanding.toFixed(2)} (${outstandingInvoices.length} invoices)
- GST collected this month (est.): $${gstCollected.toFixed(2)} at ${(gstRate * 100).toFixed(0)}%
- Avg sale value: $${sales.length > 0 ? (totalRevenue60d / sales.length).toFixed(2) : "0"}

Payment breakdown (60 days):
${Object.entries(paymentBreakdown).map(([m, v]) => `- ${m}: $${v.toFixed(2)}`).join("\n") || "- No data"}

Top customers (60 days):
${topCustomers.map(([n, v]) => `- ${n}: $${v.toFixed(2)}`).join("\n") || "- No data"}

Low-stock items:
${(inventoryData.data ?? []).filter((i) => i.track_quantity && i.quantity <= (i.low_stock_threshold ?? 1)).map((i) => `- ${i.name}: ${i.quantity} left`).join("\n") || "- None"}

Answer questions about this business's finances concisely and helpfully. Use specific numbers from the data above. If you don't have enough data to answer accurately, say so.`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    logger.error("Financial chat error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
