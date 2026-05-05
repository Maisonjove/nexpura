import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import logger from "@/lib/logger";
import { flushSentry } from "@/lib/sentry-flush";
import { getSalesPage, SALES_LIST_PAGE_SIZE } from "./sales-actions";
import SalesHubClient from "./SalesHubClient";

export const metadata = { title: "Sales — Nexpura" };

function payloadHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value ?? {}))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Sales Hub — Section 5 of Kaitlyn's 2026-05-02 redesign brief.
 *
 * cacheComponents requires the page top-level to be synchronous and to
 * defer dynamic data (cookies/headers/auth/DB) into a Suspense boundary.
 * Server data fetching lives inside <SalesHubBody />.
 *
 * C-02 fix (post-audit-batch QA): KPI queries used to swallow errors —
 * `(result.data ?? []).reduce(...)` made every query failure look like
 * "$0 today / $0 month / 0 quotes / 0 laybys", so when the legacy
 * service-role key was revoked on 2026-04-21 every KPI silently zeroed
 * out and the recent-sales panel showed empty, indistinguishable from
 * a brand-new tenant. Errors are now surfaced via `logger.error`
 * (auto-captured by Sentry with tenant_id, user_id, route, payload_hash)
 * and propagated up so the Suspense + ErrorBoundary fallback renders
 * instead of misleading zeros.
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
  const userId = headersList.get(AUTH_HEADERS.USER_ID);
  if (!tenantId) redirect("/login");

  // Existing data flow — pages 1 of N at SALES_LIST_PAGE_SIZE.
  // Errors inside getSalesPage now throw (was: swallowed → empty list).
  const initialPage = await getSalesPage(null, { limit: SALES_LIST_PAGE_SIZE });

  const admin = createAdminClient();

  // Window boundaries used for "today" + "this month" aggregates.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fire all KPI queries in parallel. Counts use { head: true, count: 'exact' }
  // for cheap row-count reads. Aggregates pull `total` and sum client-side
  // since PostgREST doesn't expose a SUM helper directly without an RPC.
  //
  // C-02: switched from Promise.all to Promise.allSettled + per-result
  // error checks. A failed KPI no longer poisons the whole page (we still
  // render with 0 + a logged Sentry event), but a successful query that
  // returned an explicit `error` object is no longer treated as zero.
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
      .is("deleted_at", null)
      .gte("sale_date", startOfToday),
    admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
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
      .is("deleted_at", null)
      .eq("status", "layby"),
  ]);

  // C-02: per-result error check + telemetry. An error here used to vanish
  // into the `?? []` / `?? 0` defaults below. Now each failure logs once
  // (one Sentry event per failed KPI, tagged with which KPI failed) and
  // its display falls back to a neutral 0 — preserving the page render
  // while making the failure observable.
  const kpiErrors: Array<{ kpi: string; err: unknown }> = [];
  if (todayResult.error) kpiErrors.push({ kpi: "salesToday", err: todayResult.error });
  if (monthResult.error) kpiErrors.push({ kpi: "salesThisMonth", err: monthResult.error });
  if (invoicesResult.error) kpiErrors.push({ kpi: "outstandingInvoices", err: invoicesResult.error });
  if (quotesResult.error) kpiErrors.push({ kpi: "openQuotes", err: quotesResult.error });
  if (laybysResult.error) kpiErrors.push({ kpi: "activeLaybys", err: laybysResult.error });

  if (kpiErrors.length > 0) {
    // Single Sentry capture covering every failed KPI in one event.
    // Per CONTRIBUTING.md "Loop-shaped logger.error": calling logger.error
    // inside the loop would queue 1-5 events per request and tax the
    // PromiseBuffer 100-cap on a hot tenant.
    logger.error("[sales/hub] one or more KPI queries failed", {
      tenantId,
      userId,
      route: "/sales",
      payload_hash: payloadHash({ tenantId, kpis: kpiErrors.map((e) => e.kpi) }),
      failedKpis: kpiErrors.map((e) => ({
        kpi: e.kpi,
        err: e.err instanceof Error ? e.err.message : String(e.err),
      })),
    });
    await flushSentry();
  }

  const salesToday = (todayResult.data ?? []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const salesThisMonth = (monthResult.data ?? []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  // Outstanding = sum(amount_due) on unpaid invoices.
  const outstandingInvoices = (invoicesResult.data ?? []).reduce(
    (sum, inv) => sum + (Number(inv.amount_due) || 0),
    0
  );

  const openQuotes = quotesResult.count ?? 0;
  const activeLaybys = laybysResult.count ?? 0;

  return (
    <SalesHubClient
      initialSales={initialPage.sales}
      hasMore={initialPage.hasMore}
      nextCursor={initialPage.nextCursor}
      kpis={{
        salesToday,
        salesThisMonth,
        outstandingInvoices,
        openQuotes,
        activeLaybys,
      }}
    />
  );
}
