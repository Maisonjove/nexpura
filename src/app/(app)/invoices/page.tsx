import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth-context";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Skeleton } from "@/components/ui/skeleton";
import InvoiceListClient from "./InvoiceListClient";

export const metadata = { title: "Invoices — Nexpura" };

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

  const isReviewMode = !!(params.rt && REVIEW_TOKENS.includes(params.rt));

  let tenantId: string;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Shell — title + New Invoice button ship in the first packet, no DB dependency. */}
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl text-stone-900">Invoices</h1>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Invoice
        </Link>
      </div>

      {/* Stats + table stream in behind Suspense. */}
      <Suspense key={`${q}:${page}:${statusFilter}`} fallback={<InvoicesBodySkeleton />}>
        <InvoicesBody tenantId={tenantId} q={q} statusFilter={statusFilter} page={page} />
      </Suspense>
    </div>
  );
}

async function InvoicesBody({
  tenantId,
  q,
  statusFilter,
  page,
}: {
  tenantId: string;
  q: string;
  statusFilter: string;
  page: number;
}) {
  const pageSize = 200;
  const offset = (page - 1) * pageSize;
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const fetchInvoicesPayload = unstable_cache(
    async () => {
      const [outstandingRes, overdueRes, paidThisMonthRes, listResult, countResult] = await Promise.all([
        admin.from("invoices").select("amount_due")
          .eq("tenant_id", tenantId).in("status", ["unpaid", "partial", "overdue"])
          .is("deleted_at", null),
        admin.from("invoices").select("amount_due")
          .eq("tenant_id", tenantId)
          .not("status", "in", '("paid","voided","draft","cancelled")')
          .lt("due_date", today).is("deleted_at", null),
        admin.from("invoices").select("total")
          .eq("tenant_id", tenantId).eq("status", "paid")
          .gte("paid_at", monthStart).is("deleted_at", null),
        (async () => {
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
        })(),
        (async () => {
          let cq = admin
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          if (q) cq = cq.ilike("invoice_number", `%${q}%`);
          const { count } = await cq;
          return count ?? 0;
        })(),
      ]);
      return {
        totalOutstanding: (outstandingRes.data ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0),
        totalOverdue: (overdueRes.data ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0),
        paidThisMonth: (paidThisMonthRes.data ?? []).reduce((s, i) => s + (Number(i.total) || 0), 0),
        invoices: listResult.data ?? [],
        count: countResult,
      };
    },
    ["invoices", tenantId, String(page), q || "nq"],
    { tags: [CACHE_TAGS.invoices(tenantId)], revalidate: 3600 }
  );

  const payload = await fetchInvoicesPayload();
  const { totalOutstanding, totalOverdue, paidThisMonth, count } = payload;
  const totalPages = Math.ceil((count || 0) / pageSize);

  const normalizedInvoices: InvoiceRow[] = (payload.invoices ?? []).map((inv) => ({
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
      hideTitleBlock
    />
  );
}

function InvoicesBodySkeleton() {
  return (
    <>
      {/* Stats card row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg flex-shrink-0" />
        ))}
      </div>
      {/* Table */}
      <div className="nx-table-wrapper">
        <div className="px-6 py-3 border-b border-stone-100 bg-stone-50/50 flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
        <div className="divide-y divide-stone-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </>
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
