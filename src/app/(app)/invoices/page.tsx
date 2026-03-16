import { getAuthOrReviewContext } from "@/lib/auth/review";
import InvoiceListClient from "./InvoiceListClient";

export default async function InvoicesPage({
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

  const { tenantId, admin } = await getAuthOrReviewContext();
  const today = new Date().toISOString().split("T")[0];

  // ── Stats ──────────────────────────────────────────────────────────────────
  
  // Outstanding: actual DB status values are unpaid/partial/overdue
  const { data: outstandingData } = await admin
    .from("invoices")
    .select("amount_due")
    .eq("tenant_id", tenantId ?? "")
    .in("status", ["unpaid", "partial", "overdue"])
    .is("deleted_at", null);

  const totalOutstanding = (outstandingData ?? []).reduce(
    (sum, inv) => sum + (Number(inv.amount_due) || 0),
    0
  );

  const { data: overdueData } = await admin
    .from("invoices")
    .select("amount_due")
    .eq("tenant_id", tenantId ?? "")
    .not("status", "in", '("paid","voided","draft","cancelled")')
    .lt("due_date", today)
    .is("deleted_at", null);

  const totalOverdue = (overdueData ?? []).reduce(
    (sum, inv) => sum + (Number(inv.amount_due) || 0),
    0
  );

  // Paid this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString();

  const { data: paidThisMonthData } = await admin
    .from("invoices")
    .select("total")
    .eq("tenant_id", tenantId ?? "")
    .eq("status", "paid")
    .gte("paid_at", monthStartStr)
    .is("deleted_at", null);

  const paidThisMonth = (paidThisMonthData ?? []).reduce(
    (sum, p) => sum + (Number(p.total) || 0),
    0
  );

  // ── Main query ─────────────────────────────────────────────────────────────

  let query = admin
    .from("invoices")
    .select(
      "id, invoice_number, status, invoice_date, due_date, total, amount_paid, amount_due, customers(full_name)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null);

  if (statusFilter !== "all") {
    if (statusFilter === "overdue") {
      query = query
        .not("status", "in", '("paid","voided","draft","cancelled")')
        .lt("due_date", today);
    } else {
      // Map common UI filters to DB status values
      const statusMap: Record<string, string> = {
        unpaid: "unpaid",
        partial: "partial",
        paid: "paid",
        draft: "draft",
        voided: "voided"
      };
      query = query.eq("status", statusMap[statusFilter] || statusFilter);
    }
  }

  if (q) {
    query = query.ilike("invoice_number", `%${q}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data: invoices, count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  const normalizedInvoices: InvoiceRow[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    total: Number(inv.total) || 0,
    amount_due: Number(inv.amount_due) || 0,
    amount_paid: Number(inv.amount_paid) || 0,
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

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  amount_due: number;
  amount_paid: number;
  customers: { full_name: string | null } | null;
};
