import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import InvoiceListClient from "./InvoiceListClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || "all";
  const page = parseInt(params.page || "1");
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const admin = createAdminClient();

  // Check for review mode or auth
  let tenantId: string | null = null;
  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
  }

  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Parallel fetch: stats + list
  const [outstandingRes, overdueRes, paidThisMonthRes, listResult] = await Promise.all([
    // Outstanding total
    admin
      .from("invoices")
      .select("amount_due")
      .eq("tenant_id", tenantId)
      .in("status", ["unpaid", "partial", "overdue"])
      .is("deleted_at", null),
    // Overdue total
    admin
      .from("invoices")
      .select("amount_due")
      .eq("tenant_id", tenantId)
      .not("status", "in", '("paid","voided","draft","cancelled")')
      .lt("due_date", today)
      .is("deleted_at", null),
    // Paid this month
    admin
      .from("invoices")
      .select("total")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("paid_at", monthStart)
      .is("deleted_at", null),
    // List query with filters
    (async () => {
      let query = admin
        .from("invoices")
        .select(
          "id, invoice_number, status, invoice_date, due_date, total, amount_paid, amount_due, customers(full_name)",
          { count: "exact" }
        )
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

      if (statusFilter !== "all") {
        if (statusFilter === "overdue") {
          query = query
            .not("status", "in", '("paid","voided","draft","cancelled")')
            .lt("due_date", today);
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      if (q) query = query.ilike("invoice_number", `%${q}%`);

      return query
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
    })(),
  ]);

  const totalOutstanding = (outstandingRes.data ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
  const totalOverdue = (overdueRes.data ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
  const paidThisMonth = (paidThisMonthRes.data ?? []).reduce((s, i) => s + (Number(i.total) || 0), 0);

  const { data: invoices, count } = listResult;
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
    customers: Array.isArray(inv.customers) ? (inv.customers[0] ?? null) : inv.customers,
  }));

  return (
    <InvoiceListClient
      invoices={normalizedInvoices}
      totalCount={count || 0}
      page={page}
      totalPages={totalPages}
      q={q}
      statusFilter={statusFilter}
      stats={{ totalOutstanding, totalOverdue, paidThisMonth }}
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
