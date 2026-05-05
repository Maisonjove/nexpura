/**
 * Shopify partial-import reconciliation cron (PR-13, Joey 2026-05-04).
 *
 * Background: `importOrdersFromShopify` writes a `sales` row, then
 * loops over `order.line_items` inserting each into `sale_items`.
 * If a line_item insert fails (transient DB error, FK violation,
 * etc.), the parent sale is left flagged `import_status='incomplete'`
 * — visible in app but missing items. Pre-PR-13 the next sync run
 * would skip the sale entirely (existing-check matched), so the
 * orphan never self-healed and the customer's view drifted from
 * Shopify's permanently.
 *
 * This cron picks up incomplete sales every 6 hours and re-fetches
 * the upstream Shopify order to fill the gaps. On success the sale
 * moves `incomplete` → `reconciled`; on continued failure it stays
 * `incomplete` and the next cron run retries.
 *
 * Why a cron and not just inline heal on resync:
 *   importOrdersFromShopify only sees orders within
 *   `created_at_min=last_orders_sync` window. Once an order falls
 *   out of that window (closed / old / not modified), Shopify won't
 *   send it again on a normal import run, so inline heal alone
 *   doesn't reach old orphans. The cron sweeps the whole table and
 *   fetches per-sale orders by id.
 *
 * Schedule: every 6 hours, on the hour (cron expr "0 0,6,12,18 * * *"
 * equivalent: "0 *\/6 * * *", configured in vercel.json). Aligned to
 * `0` so it runs deterministically off-peak for AU traffic. Vercel
 * crons are tenant-global (not per-tenant), so we batch all tenants
 * in one request and surface per-tenant failures via Sentry.
 *
 * Auth: bearer-token (CRON_SECRET) via `safeBearerMatch` for
 * timing-attack resistance — same shape as every other Vercel cron
 * in this repo.
 */

import { withSentryFlush } from "@/lib/sentry-flush";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import { reconcileIncompleteShopifySale } from "@/lib/integrations/shopify/sync";
import logger from "@/lib/logger";

// Cap each cron run at 100 sales. Vercel function timeout is 60s by
// default; each Shopify GET /orders/<id>.json round-trip is ~300-800ms,
// plus per-line_item supabase inserts. 100 is a safe ceiling that lets
// the cron drain a backlog over 1-2 runs without timing out. If a
// real backlog (e.g. an outage created hundreds of orphans) shows up,
// raise the cap or split per-tenant.
const RECONCILIATION_BATCH_SIZE = 100;

export const GET = withSentryFlush(async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!safeBearerMatch(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    // Pull incomplete shopify-flagged sales. Order by created_at so
    // we drain the oldest orphans first (longest-suffering customer
    // gets healed first). The partial index
    // `sales_import_status_incomplete_idx` makes this query cheap.
    //
    // half-fix-pair: cron-iterates-tenants family (cleanup #23 + #29-32,
    // see docs/CONTRIBUTING.md §13). Sibling lifecycle crons
    // (grace-period-checker / trial-end-checker / process-tenant-deletions)
    // already gate on `tenants.deleted_at IS NULL`; without the same
    // gate here, this cron would keep hitting Shopify's API on behalf
    // of soft-deleted tenants — burning the (now-revoked-from-the-
    // customer's-side) integration creds and writing back to a
    // wound-down tenant's sales table. Inner-join + deleted_at filter
    // mirrors the storefront /api/shop/* fixes.
    const { data: orphans, error: orphansErr } = await admin
      .from("sales")
      .select("id, tenant_id, external_reference, tenants!inner(deleted_at)")
      .eq("import_status", "incomplete")
      .is("tenants.deleted_at", null)
      .like("external_reference", "shopify_%")
      .order("created_at", { ascending: true })
      .limit(RECONCILIATION_BATCH_SIZE);

    if (orphansErr) {
      logger.error("[cron/shopify-reconciliation] orphan query failed", { error: orphansErr });
      return NextResponse.json({ ok: false, error: "orphan_query_failed" }, { status: 500 });
    }

    let reconciled = 0;
    let stillIncomplete = 0;
    let unrecoverable = 0;
    // Capture-amplification fix (no-logger-error-in-loop): collect
    // failure details, log once after the loop. Per-orphan
    // logger.error calls in a loop can blow the Sentry PromiseBuffer
    // cap and silently drop events when a backlog hits.
    const failures: Array<{ saleId: string; tenantId: string; status: string; details: string }> = [];

    for (const orphan of orphans ?? []) {
      const result = await reconcileIncompleteShopifySale(orphan.tenant_id, {
        id: orphan.id,
        external_reference: orphan.external_reference,
      });

      if (result.status === "reconciled") {
        reconciled++;
      } else {
        if (result.status === "still_incomplete") stillIncomplete++;
        else unrecoverable++;
        failures.push({
          saleId: orphan.id,
          tenantId: orphan.tenant_id,
          status: result.status,
          details: result.details,
        });
      }
    }

    if (failures.length > 0) {
      logger.error(
        `[cron/shopify-reconciliation] ${failures.length} sale(s) failed to reconcile`,
        { count: failures.length, failures },
      );
    }

    logger.info("[cron/shopify-reconciliation] run complete", {
      scanned: orphans?.length ?? 0,
      reconciled,
      stillIncomplete,
      unrecoverable,
    });

    return NextResponse.json({
      ok: true,
      scanned: orphans?.length ?? 0,
      reconciled,
      stillIncomplete,
      unrecoverable,
    });
  } catch (err) {
    logger.error("[cron/shopify-reconciliation] failed", { error: err });
    return NextResponse.json({ ok: false, error: "cron_failed" }, { status: 500 });
  }
});
