"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { tenantId: userData.tenant_id as string };
}

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export async function getRevenueByDateRange(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { total: number; count: number; byMonth: { month: string; total: number }[] }; error?: string }> {
  try {
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

    return { data: { total, count, byMonth } };
  } catch (e) {
    return { data: { total: 0, count: 0, byMonth: [] }, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getRevenueByCategoryByDateRange(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { category: string; total: number; count: number }[]; error?: string }> {
  try {
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
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { total: number; completed: number; revenue: number; avgDays: number }; error?: string }> {
  try {
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

    return { data: { total, completed, revenue, avgDays: Math.round(avgDays) } };
  } catch (e) {
    return { data: { total: 0, completed: 0, revenue: 0, avgDays: 0 }, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getBespokeStats(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { total: number; completed: number; avgValue: number }; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("bespoke_jobs")
      .select("status, total_price, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo + "T23:59:59");

    const total = data?.length ?? 0;
    const completed = (data ?? []).filter((b) => b.status === "completed").length;
    const avgValue =
      total > 0
        ? (data ?? []).reduce((s, b) => s + (b.total_price ?? 0), 0) / total
        : 0;

    return { data: { total, completed, avgValue: Math.round(avgValue) } };
  } catch (e) {
    return { data: { total: 0, completed: 0, avgValue: 0 }, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function getExpenseSummary(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { category: string; total: number }[]; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("expenses")
      .select("category, amount")
      .eq("tenant_id", tenantId)
      .gte("expense_date", dateFrom)
      .lte("expense_date", dateTo);

    if (!data) return { data: [] };

    const catMap: Record<string, number> = {};
    for (const exp of data) {
      const cat = exp.category || "Other";
      catMap[cat] = (catMap[cat] ?? 0) + (exp.amount ?? 0);
    }
    const result = Object.entries(catMap).map(([category, total]) => ({ category, total }));
    return { data: result };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function exportReportCSV(
  tenantId: string,
  reportType: string,
  dateFrom: string,
  dateTo: string
): Promise<{ csv?: string; error?: string }> {
  try {
    const admin = createAdminClient();

    if (reportType === "revenue") {
      const { data } = await admin
        .from("invoices")
        .select("invoice_number, invoice_date, customer_name, total, status")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo)
        .order("invoice_date");

      const headers = "Invoice Number,Date,Customer,Total,Status";
      const rows = (data ?? []).map(
        (i) => `"${i.invoice_number}","${i.invoice_date}","${i.customer_name ?? ""}","${i.total}","${i.status}"`
      );
      return { csv: [headers, ...rows].join("\n") };
    }

    if (reportType === "repairs") {
      const { data } = await admin
        .from("repairs")
        .select("repair_number, customer_name, description, status, price, received_date, completion_date")
        .eq("tenant_id", tenantId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at");

      const headers = "Repair Number,Customer,Description,Status,Price,Received,Completed";
      const rows = (data ?? []).map(
        (r) => `"${r.repair_number ?? ""}","${r.customer_name ?? ""}","${r.description ?? ""}","${r.status}","${r.price ?? 0}","${r.received_date ?? ""}","${r.completion_date ?? ""}"`
      );
      return { csv: [headers, ...rows].join("\n") };
    }

    if (reportType === "expenses") {
      const { data } = await admin
        .from("expenses")
        .select("description, category, amount, expense_date, notes")
        .eq("tenant_id", tenantId)
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo)
        .order("expense_date");

      const headers = "Description,Category,Amount,Date,Notes";
      const rows = (data ?? []).map(
        (e) => `"${e.description ?? ""}","${e.category ?? ""}","${e.amount ?? 0}","${e.expense_date ?? ""}","${e.notes ?? ""}"`
      );
      return { csv: [headers, ...rows].join("\n") };
    }

    return { error: `Unknown report type: ${reportType}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
