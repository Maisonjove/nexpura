import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import { getSales } from "./sales-actions";
import SalesHubClient from "./SalesHubClient";

export const metadata = { title: "Sales — Nexpura" };

/**
 * Sales Hub — Section 5 of Kaitlyn's 2026-05-02 redesign brief.
 *
 * cacheComponents requires the page top-level to be synchronous and to
 * defer dynamic data (cookies/headers/auth/DB) into a Suspense boundary.
 * Server data fetching lives inside <SalesHubBody />.
 */
export default function SalesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <SalesHubBody />
    </Suspense>
  );
}

async function SalesHubBody() {
  const headersList = await headers();
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  // Existing data flow — unchanged.
  const initialSales = await getSales(null);

  const admin = createAdminClient();

  // Window boundaries used for "today" + "this month" aggregates.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fire all KPI queries in parallel. Counts use { head: true, count: 'exact' }
  // for cheap row-count reads. Aggregates pull `total` and sum client-side
  // since PostgREST doesn't expose a SUM helper directly without an RPC.
  const [
    todayResult,
    monthResult,
    invoicesResult,
    quotesResult,
    laybysResult,
  ] = await Promise.all([
    admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("sale_date", startOfToday),
    admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("sale_date", startOfMonth),
    // Outstanding invoices — sum of `amount_due` for unpaid statuses.
    // Mirrors src/app/(app)/invoices/page.tsx aggregation. `deleted_at is
    // null` is implicit there but explicit here for safety.
    admin
      .from("invoices")
      .select("amount_due")
      .eq("tenant_id", tenantId)
      .in("status", ["unpaid", "partial", "overdue"])
      .is("deleted_at", null),
    // Open quotes = anything not yet converted/rejected/expired.
    admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("status", "in", '("converted","rejected","expired","cancelled","void")'),
    admin
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "layby"),
  ]);

  const salesToday = (todayResult.data ?? []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const salesThisMonth = (monthResult.data ?? []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const monthSaleCount = (monthResult.data ?? []).length;
  const avgOrderValue = monthSaleCount > 0 ? salesThisMonth / monthSaleCount : 0;

  // Outstanding = sum(amount_due) on unpaid invoices.
  const outstandingInvoices = (invoicesResult.data ?? []).reduce(
    (sum, inv) => sum + (Number(inv.amount_due) || 0),
    0
  );

  const openQuotes = quotesResult.count ?? 0;
  const activeLaybys = laybysResult.count ?? 0;

  return (
    <SalesHubClient
      initialSales={initialSales}
      kpis={{
        salesToday,
        salesThisMonth,
        outstandingInvoices,
        openQuotes,
        activeLaybys,
        avgOrderValue,
      }}
    />
  );
}
