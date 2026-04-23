"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCached, tenantCacheKey } from "@/lib/cache";
import { getSessionTenantId } from "@/lib/auth/assert-tenant";
import { buildCsv } from "@/lib/csv/escape";

/**
 * Launch-QA W4-XTENANT1: every reports aggregator previously took
 * `tenantId: string` as its first argument and filtered the query by it.
 * That let any authenticated user query another tenant's revenue/repairs/
 * expenses/etc. by passing a foreign UUID. Tenant is now resolved from the
 * session on the server; the client no longer supplies it.
 */

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export async function getRevenueByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<{ data: { total: number; totalCost: number; count: number; byMonth: { month: string; total: number }[] }; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const cacheKey = tenantCacheKey(tenantId, "revenue", dateFrom, dateTo);

    const result = await getCached(cacheKey, async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("invoices")
        .select("total, invoice_date")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);

      const total = (data ?? []).reduce((s, i) => s + (i.total ?? 0), 0);
      const count = data?.length ?? 0;

      // Group by month
      const monthMap: Record<string, number> = {};
      for (const inv of data ?? []) {
        const month = inv.invoice_date?.slice(0, 7) ?? "unknown";
        monthMap[month] = (monthMap[month] ?? 0) + (inv.total ?? 0);
      }
      const byMonth = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, total }));

      const totalCost = 0;
      return { total, totalCost, count, byMonth };
    }, 300); // 5 min TTL

    return { data: result };
  } catch (e) {
    return { data: { total: 0, totalCost: 0, count: 0, byMonth: [] }, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getRevenueByCategoryByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<{ data: { category: string; total: number; count: number }[]; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const admin = createAdminClient();
    // Join invoice_line_items → invoices, or use sales data
    // Simplified: use invoice_line_items description as proxy
    const { data: invoices } = await admin
      .from("invoices")
      .select("total, notes")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("invoice_date", dateFrom)
      .lte("invoice_date", dateTo);

    // Simplified category: just return "Sales"
    const total = (invoices ?? []).reduce((s, i) => s + (i.total ?? 0), 0);
    return { data: [{ category: "Sales", total, count: invoices?.length ?? 0 }] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getRepairStats(
  dateFrom: string,
  dateTo: string
): Promise<{ data: { total: number; completed: number; revenue: number; avgDays: number }; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const cacheKey = tenantCacheKey(tenantId, "repairs", dateFrom, dateTo);

    const result = await getCached(cacheKey, async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("repairs")
        .select("status, price, completion_date, received_date, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59");

      const total = data?.length ?? 0;
      const completed = (data ?? []).filter((r) => r.status === "completed").length;
      const revenue = (data ?? []).reduce((s, r) => s + (r.price ?? 0), 0);

      const completedWithDates = (data ?? []).filter(
        (r) => r.status === "completed" && r.completion_date && r.received_date
      );
      const avgDays =
        completedWithDates.length > 0
          ? completedWithDates.reduce((s, r) => {
              const days = Math.floor(
                (new Date(r.completion_date!).getTime() - new Date(r.received_date!).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              return s + days;
            }, 0) / completedWithDates.length
          : 0;

      return { total, completed, revenue, avgDays: Math.round(avgDays) };
    }, 300); // 5 min TTL

    return { data: result };
  } catch (e) {
    return { data: { total: 0, completed: 0, revenue: 0, avgDays: 0 }, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getBespokeStats(
  dateFrom: string,
  dateTo: string
): Promise<{ data: { total: number; completed: number; avgValue: number }; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const admin = createAdminClient();
    const { data } = await admin
      .from("bespoke_jobs")
      .select("status, quoted_price, final_price, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo + "T23:59:59");

    const total = data?.length ?? 0;
    const completed = (data ?? []).filter((b) => b.status === "completed").length;
    const avgValue =
      total > 0
        ? (data ?? []).reduce((s, b) => s + (b.final_price ?? b.quoted_price ?? 0), 0) / total
        : 0;

    return { data: { total, completed, avgValue: Math.round(avgValue) } };
  } catch (e) {
    return { data: { total: 0, completed: 0, avgValue: 0 }, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getExpenseSummary(
  dateFrom: string,
  dateTo: string
): Promise<{ data: { category: string; total: number }[]; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const cacheKey = tenantCacheKey(tenantId, "expenses", dateFrom, dateTo);

    const result = await getCached(cacheKey, async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("expenses")
        .select("category, amount")
        .eq("tenant_id", tenantId)
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo);

      if (!data) return [];

      const catMap: Record<string, number> = {};
      for (const exp of data) {
        const cat = exp.category || "Other";
        catMap[cat] = (catMap[cat] ?? 0) + (exp.amount ?? 0);
      }
      return Object.entries(catMap).map(([category, total]) => ({ category, total }));
    }, 300); // 5 min TTL

    return { data: result };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function exportReportCSV(
  reportType: string,
  dateFrom: string,
  dateTo: string
): Promise<{ csv?: string; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const admin = createAdminClient();

    // W6-HIGH-05 / W4-REPORT8: all three report types route through
    // buildCsv(), which prefixes formula-triggering cells (starts with
    // =, +, -, @, \t, \r) with an apostrophe before RFC-4180 quoting.
    if (reportType === "revenue") {
      const { data } = await admin
        .from("invoices")
        .select("invoice_number, invoice_date, customer_name, total, status")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo)
        .order("invoice_date");

      const headers = ["Invoice Number", "Date", "Customer", "Total", "Status"];
      const rows = (data ?? []).map((i) => ({
        "Invoice Number": i.invoice_number,
        "Date": i.invoice_date,
        "Customer": i.customer_name ?? "",
        "Total": i.total,
        "Status": i.status,
      }));
      return { csv: buildCsv(headers, rows) };
    }

    if (reportType === "repairs") {
      const { data } = await admin
        .from("repairs")
        .select("repair_number, customer_name, description, status, price, received_date, completion_date")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at");

      const headers = ["Repair Number", "Customer", "Description", "Status", "Price", "Received", "Completed"];
      const rows = (data ?? []).map((r) => ({
        "Repair Number": r.repair_number ?? "",
        "Customer": r.customer_name ?? "",
        "Description": r.description ?? "",
        "Status": r.status,
        "Price": r.price ?? 0,
        "Received": r.received_date ?? "",
        "Completed": r.completion_date ?? "",
      }));
      return { csv: buildCsv(headers, rows) };
    }

    if (reportType === "expenses") {
      const { data } = await admin
        .from("expenses")
        .select("description, category, amount, expense_date, notes")
        .eq("tenant_id", tenantId)
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo)
        .order("expense_date");

      const headers = ["Description", "Category", "Amount", "Date", "Notes"];
      const rows = (data ?? []).map((e) => ({
        "Description": e.description ?? "",
        "Category": e.category ?? "",
        "Amount": e.amount ?? 0,
        "Date": e.expense_date ?? "",
        "Notes": e.notes ?? "",
      }));
      return { csv: buildCsv(headers, rows) };
    }

    return { error: `Unknown report type: ${reportType}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

// ── Supplier Performance ──────────────────────────────────────

export async function getSupplierPerformance(
  dateFrom: string,
  dateTo: string
): Promise<{ data: { supplier: string; total: number; orderCount: number }[]; error?: string }> {
  try {
    const tenantId = await getSessionTenantId();
    const cacheKey = tenantCacheKey(tenantId, "suppliers", dateFrom, dateTo);

    const result = await getCached(cacheKey, async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("purchase_orders")
        .select("supplier_name, total_amount")
        .eq("tenant_id", tenantId)
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo);

      if (!data) return [];

      const map: Record<string, { total: number; count: number }> = {};
      for (const po of data) {
        const name = po.supplier_name || "Unknown";
        if (!map[name]) map[name] = { total: 0, count: 0 };
        map[name].total += po.total_amount ?? 0;
        map[name].count += 1;
      }

      return Object.entries(map)
        .map(([supplier, { total, count }]) => ({ supplier, total, orderCount: count }))
        .sort((a, b) => b.total - a.total);
    }, 300); // 5 min TTL

    return { data: result };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

// ── Payment Status Overview ───────────────────────────────────

export async function getPaymentStatusOverview(
  dateFrom: string,
  dateTo: string
): Promise<{
  data: {
    totalInvoices: number;
    totalAmount: number;
    paid: number;
    paidAmount: number;
    unpaid: number;
    unpaidAmount: number;
    overdue: number;
    overdueAmount: number;
    overdueList: Array<{ id: string; invoice_number: string; customer_name: string | null; total: number; due_date: string | null; }>;
  };
  error?: string;
}> {
  try {
    const tenantId = await getSessionTenantId();
    const cacheKey = tenantCacheKey(tenantId, "payments", dateFrom, dateTo);

    const result = await getCached(cacheKey, async () => {
      const admin = createAdminClient();
      const today = new Date().toISOString().split("T")[0];

      const { data } = await admin
        .from("invoices")
        .select("id, invoice_number, customer_name, total, status, due_date")
        .eq("tenant_id", tenantId)
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);

      if (!data) return { totalInvoices: 0, totalAmount: 0, paid: 0, paidAmount: 0, unpaid: 0, unpaidAmount: 0, overdue: 0, overdueAmount: 0, overdueList: [] as Array<{ id: string; invoice_number: string; customer_name: string | null; total: number; due_date: string | null; }> };

      const paid = data.filter((i) => i.status === "paid");
      const unpaid = data.filter((i) => i.status !== "paid" && i.status !== "voided");
      const overdue = data.filter((i) => i.status !== "paid" && i.status !== "voided" && i.due_date && i.due_date < today);

      return {
        totalInvoices: data.length,
        totalAmount: data.reduce((s, i) => s + (i.total ?? 0), 0),
        paid: paid.length,
        paidAmount: paid.reduce((s, i) => s + (i.total ?? 0), 0),
        unpaid: unpaid.length,
        unpaidAmount: unpaid.reduce((s, i) => s + (i.total ?? 0), 0),
        overdue: overdue.length,
        overdueAmount: overdue.reduce((s, i) => s + (i.total ?? 0), 0),
        overdueList: overdue.map((i) => ({
          id: i.id,
          invoice_number: i.invoice_number,
          customer_name: i.customer_name,
          total: i.total ?? 0,
          due_date: i.due_date,
        })),
      };
    }, 180); // 3 min TTL (payment status changes more frequently)

    return { data: result };
  } catch (e) {
    return {
      data: { totalInvoices: 0, totalAmount: 0, paid: 0, paidAmount: 0, unpaid: 0, unpaidAmount: 0, overdue: 0, overdueAmount: 0, overdueList: [] },
      error: e instanceof Error ? e.message : "Error",
    };
  }
}
