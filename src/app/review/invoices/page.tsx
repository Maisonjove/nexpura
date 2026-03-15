import { createAdminClient } from "@/lib/supabase/admin";
import InvoiceListClient from "@/app/(app)/invoices/InvoiceListClient";
import type { InvoiceRow } from "@/app/(app)/invoices/page";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export const revalidate = 60;

export default async function ReviewInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || "all";
  const page = parseInt(params.page || "1");
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: outstandingData } = await admin
    .from("invoices")
    .select("total")
    .eq("tenant_id", TENANT_ID)
    .in("status", ["sent", "partially_paid", "overdue"]);

  const totalOutstanding = (outstandingData ?? []).reduce(
    (sum, inv) => sum + (inv.total || 0),
    0
  );

  const { data: overdueData } = await admin
    .from("invoices")
    .select("total")
    .eq("tenant_id", TENANT_ID)
    .not("status", "in", '("paid","voided","draft")')
    .lt("due_date", today);

  const totalOverdue = (overdueData ?? []).reduce(
    (sum, inv) => sum + (inv.total || 0),
    0
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const { data: paidThisMonthData } = await admin
    .from("invoices")
    .select("total")
    .eq("tenant_id", TENANT_ID)
    .eq("status", "paid")
    .gte("paid_at", monthStartStr);

  const paidThisMonth = (paidThisMonthData ?? []).reduce(
    (sum, p) => sum + (p.total || 0),
    0
  );

  let query = admin
    .from("invoices")
    .select("id, invoice_number, status, invoice_date, due_date, total, customers(full_name)", { count: "exact" })
    .eq("tenant_id", TENANT_ID);

  if (statusFilter !== "all") {
    if (statusFilter === "overdue") {
      query = query.not("status", "in", '("paid","voided","draft")').lt("due_date", today);
    } else {
      query = query.eq("status", statusFilter);
    }
  }

  if (q) {
    query = query.ilike("invoice_number", `%${q}%`);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data: invoices, count } = await query;

  const totalPages = Math.ceil((count || 0) / pageSize);

  const normalizedInvoices: InvoiceRow[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    total: inv.total,
    amount_due: inv.status === "paid" ? 0 : (inv.total || 0),
    amount_paid: inv.status === "paid" ? (inv.total || 0) : 0,
    customers: Array.isArray(inv.customers)
      ? (inv.customers[0] ?? null)
      : inv.customers,
  }));

  return (
    <InvoiceListClient
      invoices={normalizedInvoices}
      totalCount={count || 0}
      page={page}
      totalPages={totalPages}
      q={q}
      statusFilter={statusFilter}
      stats={{
        totalOutstanding,
        totalOverdue,
        paidThisMonth,
      }}
    />
  );
}
