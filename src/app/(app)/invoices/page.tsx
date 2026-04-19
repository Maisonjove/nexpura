import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
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
  // 200 per page — status filtering is client-side now, so the page needs to
  // hold enough rows for common tab clicks to still show meaningful data.
  // Matches /repairs and /bespoke.
  const pageSize = 200;
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

  // Stats are cached 30 s per-tenant — they sum across potentially-thousands
  // of rows even when only one column is selected, and running them on every
  // nav dominated TTFB. 30 s staleness is invisible to a jeweller using the
  // page (invoices don't get paid multiple times in 30 s).
  const statsPromise = getCached(
    tenantCacheKey(tenantId, "invoices-stats-v1"),
    async () => {
      const [outstandingRes, overdueRes, paidThisMonthRes] = await Promise.all([
        admin
          .from("invoices")
          .select("amount_due")
          .eq("tenant_id", tenantId)
          .in("status", ["unpaid", "partial", "overdue"])
          .is("deleted_at", null),
        admin
          .from("invoices")
          .select("amount_due")
          .eq("tenant_id", tenantId)
          .not("status", "in", '("paid","voided","draft","cancelled")')
          .lt("due_date", today)
          .is("deleted_at", null),
        admin
          .from("invoices")
          .select("total")
          .eq("tenant_id", tenantId)
          .eq("status", "paid")
          .gte("paid_at", monthStart)
          .is("deleted_at", null),
      ]);
      return {
        totalOutstanding: (outstandingRes.data ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0),
        totalOverdue: (overdueRes.data ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0),
        paidThisMonth: (paidThisMonthRes.data ?? []).reduce((s, i) => s + (Number(i.total) || 0), 0),
      };
    },
    30
  );

  // List count — split from the list query (was count:"exact" inline) and
  // cached 30 s. Keyed on tenant + search so deep-link searches still get a
  // real count.
  const countPromise = getCached(
    tenantCacheKey(tenantId, "invoices-count", q || "all"),
    async () => {
      let cq = admin
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      if (q) cq = cq.ilike("invoice_number", `%${q}%`);
      const { count } = await cq;
      return count ?? 0;
    },
    30
  );

  // List query — no inline count. Status filter is still client-side.
  const listPromise = (async () => {
    let query = admin
      .from("invoices")
      .select(
        "id, invoice_number, status, invoice_date, due_date, total, amount_paid, amount_due, customers(full_name)"
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    if (q) query = query.ilike("invoice_number", `%${q}%`);
    return query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
  })();

  const [stats, listResult, countTotal] = await Promise.all([
    statsPromise,
    listPromise,
    countPromise,
  ]);

  const { totalOutstanding, totalOverdue, paidThisMonth } = stats;
  const { data: invoices } = listResult;
  const count = countTotal;
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
