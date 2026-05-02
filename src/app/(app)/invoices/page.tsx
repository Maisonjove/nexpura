import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAuthContext } from "@/lib/auth-context";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Skeleton } from "@/components/ui/skeleton";
import InvoiceListClient from "./InvoiceListClient";
import { locationScopeFilter } from "@/lib/location-read-scope";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";

export const metadata = { title: "Invoices — Nexpura" };

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; rt?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || "all";
  const page = parseInt(params.page || "1");
  // Section 8.2 (Kaitlyn 2026-05-02 brief): when ?status=overdue is in
  // the URL the page is rendered as the dashboard's "Overdue" deeplink —
  // focused header, oxblood KPI strip, narrowed dataset.
  const overdueOnly = statusFilter === "overdue";

  // W7-HIGH-04: env-backed constant-time check.
  const isReviewMode = matchesReviewOrStaffToken(params.rt);

  let tenantId: string;
  let userId: string | null = null;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    userId = auth.userId;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Shell — title + New Invoice button ship in the first packet, no DB dependency. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {overdueOnly && (
            <nav className="flex items-center gap-1.5 mb-1.5">
              <Link href="/dashboard" className="text-xs text-nexpura-charcoal-500 hover:text-nexpura-charcoal-700 transition-colors">
                Dashboard
              </Link>
              <span className="text-nexpura-taupe-200 text-xs">/</span>
              <Link href="/invoices" className="text-xs text-nexpura-charcoal-500 hover:text-nexpura-charcoal-700 transition-colors">
                Invoices
              </Link>
              <span className="text-nexpura-taupe-200 text-xs">/</span>
              <span className="text-xs text-nexpura-charcoal-700 font-medium">Overdue</span>
            </nav>
          )}
          <h1 className="font-semibold text-2xl text-nexpura-charcoal-700">
            {overdueOnly ? "Overdue Invoices" : "Invoices"}
          </h1>
          {overdueOnly && (
            <p className="text-sm text-nexpura-charcoal-500 mt-1">
              Track unpaid invoices and follow up with clients.
            </p>
          )}
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-nexpura-charcoal text-white rounded-lg text-sm font-medium hover:bg-nexpura-charcoal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* Stats + table stream in behind Suspense. */}
      <Suspense key={`${q}:${page}:${statusFilter}`} fallback={<InvoicesBodySkeleton />}>
        <InvoicesBody tenantId={tenantId} userId={userId} q={q} statusFilter={statusFilter} page={page} overdueOnly={overdueOnly} />
      </Suspense>
    </div>
  );
}

async function InvoicesBody({
  tenantId,
  userId,
  q,
  statusFilter,
  page,
  overdueOnly = false,
}: {
  tenantId: string;
  userId: string | null;
  q: string;
  statusFilter: string;
  page: number;
  overdueOnly?: boolean;
}) {
  const pageSize = 200;
  const offset = (page - 1) * pageSize;
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Location filter for restricted users. Applied to every invoice query
  // in this body so stats + list + count all respect the same scope.
  const locationFilter = userId ? await locationScopeFilter(userId, tenantId) : null;
  const locationCacheKey = locationFilter ?? "all";

  const fetchInvoicesPayload = unstable_cache(
    async () => {
      const [outstandingRes, overdueRes, paidThisMonthRes, listResult, countResult] = await Promise.all([
        (async () => {
          let q1 = admin.from("invoices").select("amount_due")
            .eq("tenant_id", tenantId).in("status", ["unpaid", "partial", "overdue"])
            .is("deleted_at", null);
          if (locationFilter) q1 = q1.or(locationFilter);
          return q1;
        })(),
        (async () => {
          let q2 = admin.from("invoices").select("amount_due")
            .eq("tenant_id", tenantId)
            .not("status", "in", '("paid","voided","draft","cancelled")')
            .lt("due_date", today).is("deleted_at", null);
          if (locationFilter) q2 = q2.or(locationFilter);
          return q2;
        })(),
        (async () => {
          let q3 = admin.from("invoices").select("total")
            .eq("tenant_id", tenantId).eq("status", "paid")
            .gte("paid_at", monthStart).is("deleted_at", null);
          if (locationFilter) q3 = q3.or(locationFilter);
          return q3;
        })(),
        (async () => {
          let query = admin
            .from("invoices")
            .select(
              "id, invoice_number, status, invoice_date, due_date, total, amount_paid, amount_due, customers(full_name)"
            )
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          if (q) query = query.ilike("invoice_number", `%${q}%`);
          // When the page is the /invoices?status=overdue deeplink, narrow
          // the server query to "overdue" semantics (status='overdue' OR
          // (status='unpaid' AND due_date < today)). Mirrors the predicate
          // the totalOverdue stat already uses, and saves the client from
          // filtering 200 unrelated rows down to a handful.
          if (overdueOnly) {
            query = query
              .not("status", "in", '("paid","voided","draft","cancelled")')
              .lt("due_date", today);
          }
          if (locationFilter) query = query.or(locationFilter);
          return query
            .order("due_date", { ascending: true })
            .range(offset, offset + pageSize - 1);
        })(),
        (async () => {
          let cq = admin
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          if (q) cq = cq.ilike("invoice_number", `%${q}%`);
          if (overdueOnly) {
            cq = cq
              .not("status", "in", '("paid","voided","draft","cancelled")')
              .lt("due_date", today);
          }
          if (locationFilter) cq = cq.or(locationFilter);
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
    ["invoices", tenantId, String(page), q || "nq", locationCacheKey, overdueOnly ? "overdue" : "all"],
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

  // Overdue-only KPI extras (Section 8.2). Computed from the already-
  // narrowed page slice — for tenants with >200 overdue invoices the
  // numbers are slice-scoped, which is acceptable for a quick read; the
  // totalOverdue card uses the unfiltered overdue sum so the headline
  // amount stays accurate.
  const overdueRows = overdueOnly
    ? normalizedInvoices.filter(
        (i) =>
          !["paid", "voided", "draft", "cancelled"].includes(i.status) &&
          i.due_date !== null &&
          i.due_date < today
      )
    : [];
  const todayMs = new Date(today + "T00:00:00").getTime();
  const overdueDays = overdueRows.map((r) =>
    r.due_date ? Math.max(0, Math.floor((todayMs - new Date(r.due_date + "T00:00:00").getTime()) / 86400000)) : 0
  );
  const avgDaysOverdue = overdueDays.length > 0
    ? Math.round(overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length)
    : 0;
  const highestOverdue = overdueRows.reduce((max, r) => Math.max(max, r.amount_due), 0);

  return (
    <InvoiceListClient
      invoices={normalizedInvoices}
      totalCount={count || 0}
      page={page}
      totalPages={totalPages}
      q={q}
      statusFilter={statusFilter}
      stats={{ totalOutstanding, totalOverdue, paidThisMonth }}
      overdueStats={overdueOnly ? {
        totalOverdue,
        numberOverdue: overdueRows.length,
        avgDaysOverdue,
        highestOverdue,
        paidThisMonth,
      } : undefined}
      overdueOnly={overdueOnly}
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
