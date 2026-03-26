/**
 * Report Generator
 * 
 * Generates various reports (sales, inventory, repairs, financial)
 * with CSV and HTML output formats.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/currency";

export interface ReportResult {
  summary: Record<string, unknown>;
  csv?: string;
  html?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[] | null;
}

export async function generateReport(
  tenantId: string,
  reportType: string,
  filters: Record<string, unknown> = {}
): Promise<ReportResult> {
  switch (reportType) {
    case "sales":
      return generateSalesReport(tenantId, filters);
    case "inventory":
      return generateInventoryReport(tenantId, filters);
    case "repairs":
      return generateRepairsReport(tenantId, filters);
    case "financial":
      return generateFinancialReport(tenantId, filters);
    default:
      return { summary: { error: "Unknown report type" } };
  }
}

async function generateSalesReport(
  tenantId: string,
  filters: Record<string, unknown>
): Promise<ReportResult> {
  const admin = createAdminClient();
  const period = (filters.period as string) || "week";
  
  const startDate = getStartDate(period);

  // Fetch sales data
  const { data: sales } = await admin
    .from("sales")
    .select("*, sale_items(quantity, unit_price, total)")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false });

  const { data: tenant } = await admin
    .from("tenants")
    .select("currency")
    .eq("id", tenantId)
    .single();

  const currency = tenant?.currency || "AUD";

  // Calculate summary
  const totalRevenue = sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const totalSales = sales?.length || 0;
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalItems = sales?.reduce((sum, s) => 
    sum + ((s.sale_items as Array<{ quantity: number }>)?.reduce((i, si) => i + si.quantity, 0) || 0), 0
  ) || 0;

  // Generate CSV
  const csvRows = [
    ["Sale Number", "Date", "Customer", "Items", "Total", "Payment Method"],
    ...(sales || []).map(s => [
      s.sale_number,
      new Date(s.created_at).toLocaleDateString(),
      s.customer_name || "Walk-in",
      ((s.sale_items as Array<unknown>)?.length || 0).toString(),
      formatCurrency(s.total || 0, currency),
      s.payment_method || "Unknown",
    ]),
  ];

  return {
    summary: {
      total_revenue: formatCurrency(totalRevenue, currency),
      total_sales: totalSales,
      average_sale: formatCurrency(avgSale, currency),
      items_sold: totalItems,
      period: period,
    },
    csv: csvRows.map(row => row.join(",")).join("\n"),
    data: sales ?? undefined,
  };
}

async function generateInventoryReport(
  tenantId: string,
  filters: Record<string, unknown>
): Promise<ReportResult> {
  const admin = createAdminClient();

  const { data: inventory } = await admin
    .from("inventory")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("quantity", { ascending: true });

  const { data: tenant } = await admin
    .from("tenants")
    .select("currency")
    .eq("id", tenantId)
    .single();

  const currency = tenant?.currency || "AUD";

  const totalItems = inventory?.length || 0;
  const totalValue = inventory?.reduce((sum, i) => sum + ((i.retail_price || 0) * (i.quantity || 0)), 0) || 0;
  const lowStock = inventory?.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 5)).length || 0;
  const outOfStock = inventory?.filter(i => (i.quantity || 0) === 0).length || 0;

  const csvRows = [
    ["SKU", "Name", "Category", "Quantity", "Retail Price", "Total Value", "Status"],
    ...(inventory || []).map(i => [
      i.sku || "",
      i.name,
      i.jewellery_type || "",
      (i.quantity || 0).toString(),
      formatCurrency(i.retail_price || 0, currency),
      formatCurrency((i.retail_price || 0) * (i.quantity || 0), currency),
      (i.quantity || 0) === 0 ? "Out of Stock" : (i.quantity || 0) <= (i.low_stock_threshold || 5) ? "Low Stock" : "In Stock",
    ]),
  ];

  return {
    summary: {
      total_skus: totalItems,
      total_inventory_value: formatCurrency(totalValue, currency),
      low_stock_items: lowStock,
      out_of_stock: outOfStock,
    },
    csv: csvRows.map(row => row.join(",")).join("\n"),
    data: inventory ?? undefined,
  };
}

async function generateRepairsReport(
  tenantId: string,
  filters: Record<string, unknown>
): Promise<ReportResult> {
  const admin = createAdminClient();
  const period = (filters.period as string) || "week";
  const startDate = getStartDate(period);

  const { data: jobs } = await admin
    .from("jobs")
    .select("*, customers(name)")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false });

  const { data: tenant } = await admin
    .from("tenants")
    .select("currency")
    .eq("id", tenantId)
    .single();

  const currency = tenant?.currency || "AUD";

  const totalJobs = jobs?.length || 0;
  const completed = jobs?.filter(j => j.status === "completed").length || 0;
  const pending = jobs?.filter(j => j.status === "pending" || j.status === "in_progress").length || 0;
  const totalRevenue = jobs?.filter(j => j.status === "completed").reduce((sum, j) => sum + (j.total_cost || 0), 0) || 0;

  const csvRows = [
    ["Job Number", "Date", "Customer", "Type", "Status", "Estimate", "Completion Date"],
    ...(jobs || []).map(j => [
      j.job_number,
      new Date(j.created_at).toLocaleDateString(),
      (j.customers as { name: string } | undefined)?.name || "Unknown",
      j.repair_type || "",
      j.status,
      formatCurrency(j.estimated_cost || 0, currency),
      j.completed_at ? new Date(j.completed_at).toLocaleDateString() : "",
    ]),
  ];

  return {
    summary: {
      total_jobs: totalJobs,
      completed: completed,
      pending: pending,
      completion_rate: totalJobs > 0 ? `${((completed / totalJobs) * 100).toFixed(0)}%` : "0%",
      revenue_from_completed: formatCurrency(totalRevenue, currency),
    },
    csv: csvRows.map(row => row.join(",")).join("\n"),
    data: jobs ?? undefined,
  };
}

async function generateFinancialReport(
  tenantId: string,
  filters: Record<string, unknown>
): Promise<ReportResult> {
  const admin = createAdminClient();
  const period = (filters.period as string) || "month";
  const startDate = getStartDate(period);

  const { data: tenant } = await admin
    .from("tenants")
    .select("currency")
    .eq("id", tenantId)
    .single();

  const currency = tenant?.currency || "AUD";

  // Fetch sales
  const { data: sales } = await admin
    .from("sales")
    .select("total, tax_amount, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString());

  // Fetch expenses
  const { data: expenses } = await admin
    .from("expenses")
    .select("amount, category, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString());

  // Fetch invoices
  const { data: invoices } = await admin
    .from("invoices")
    .select("total, status, paid_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate.toISOString());

  const totalRevenue = sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const totalTax = sales?.reduce((sum, s) => sum + (s.tax_amount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
  const grossProfit = totalRevenue - totalExpenses;
  const invoicesPaid = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.total || 0), 0) || 0;
  const invoicesOutstanding = invoices?.filter(i => i.status !== "paid" && i.status !== "cancelled")
    .reduce((sum, i) => sum + (i.total || 0), 0) || 0;

  return {
    summary: {
      total_revenue: formatCurrency(totalRevenue, currency),
      total_tax_collected: formatCurrency(totalTax, currency),
      total_expenses: formatCurrency(totalExpenses, currency),
      gross_profit: formatCurrency(grossProfit, currency),
      profit_margin: totalRevenue > 0 ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}%` : "0%",
      invoices_paid: formatCurrency(invoicesPaid, currency),
      invoices_outstanding: formatCurrency(invoicesOutstanding, currency),
      period: period,
    },
  };
}

function getStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.setDate(now.getDate() - 1));
    case "week":
      return new Date(now.setDate(now.getDate() - 7));
    case "month":
      return new Date(now.setMonth(now.getMonth() - 1));
    case "quarter":
      return new Date(now.setMonth(now.getMonth() - 3));
    case "year":
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(now.setDate(now.getDate() - 7));
  }
}
