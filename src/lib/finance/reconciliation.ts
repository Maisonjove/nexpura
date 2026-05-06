/**
 * Reconciliation aggregator — A1 H-02 contract.
 *
 * Single source of truth for the /financials/reconciliation page +
 * property tests + audit. Pulls totals from the 4 views the page
 * compares (sales top-line, sale_line_items, refunds, gl_entries)
 * and returns a flat structure the UI can diff.
 *
 * Contract (pinned in CONTRIBUTING.md §17 — added Day 4):
 *   - sale_line_items is the canonical line-level source.
 *   - sales.total / sales.subtotal aggregations MUST equal the
 *     sum of sale_line_items.line_total for the same (tenant, date).
 *   - refunds.total aggregations MUST equal the sum of
 *     refund_items.line_total for the same (tenant, date).
 *   - gl_entries signed sum for entry_type='refund' MUST equal
 *     -1 × sum of refunds.total in the same period.
 *   - gl_entries signed sum for entry_type='sale' MUST equal
 *     sum of sales.total in the same period (post-A1 sales also
 *     write a gl_entries row; pre-A1 they don't, so this view
 *     surfaces the gap as a delta).
 *
 * Used by:
 *   - src/app/(app)/financials/reconciliation/page.tsx (UI)
 *   - src/lib/__tests__/a1-reconciliation-property.test.ts (invariants)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DateRange {
  /** ISO timestamp, inclusive */
  fromIso: string;
  /** ISO timestamp, exclusive */
  toIso: string;
}

export interface ReconciliationTotals {
  /** Sum of sales.total in the date range (top-line revenue per tenant). */
  salesTopLine: number;
  /** Sum of sale_line_items.line_total in the date range. Should equal salesTopLine. */
  salesLineItemsSum: number;
  /** Sum of refunds.total in the date range. */
  refundsTopLine: number;
  /** Sum of refund_items.line_total in the date range. */
  refundItemsSum: number;
  /** Signed sum of gl_entries.amount where entry_type='sale' (positive). */
  glSalesNet: number;
  /** Signed sum of gl_entries.amount where entry_type='refund' (negative). */
  glRefundsNet: number;
  /** Count of rows in each table that contributed. */
  counts: {
    sales: number;
    saleLineItems: number;
    refunds: number;
    refundItems: number;
    glEntries: number;
  };
}

/**
 * Fetch reconciliation totals for a (tenant, date range). Returns the
 * 7 totals + counts the page diffs. Pure aggregation — no formatting,
 * no UI concerns. The page handles delta computation + colouring.
 */
export async function getReconciliationTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, "public", any>,
  tenantId: string,
  range: DateRange,
): Promise<ReconciliationTotals> {
  // Run the 5 aggregation queries in parallel.
  const [
    salesRes,
    salesLineItemsRes,
    refundsRes,
    refundItemsRes,
    glRes,
  ] = await Promise.all([
    admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.fromIso)
      .lt("created_at", range.toIso),
    admin
      .from("sale_items")
      .select("line_total, sales!inner(tenant_id, created_at)")
      .eq("sales.tenant_id", tenantId)
      .gte("sales.created_at", range.fromIso)
      .lt("sales.created_at", range.toIso),
    admin
      .from("refunds")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.fromIso)
      .lt("created_at", range.toIso),
    admin
      .from("refund_items")
      .select("line_total")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.fromIso)
      .lt("created_at", range.toIso),
    admin
      .from("gl_entries")
      .select("amount, entry_type")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.fromIso)
      .lt("created_at", range.toIso),
  ]);

  const sales = salesRes.data ?? [];
  const saleItems = salesLineItemsRes.data ?? [];
  const refunds = refundsRes.data ?? [];
  const refundItems = refundItemsRes.data ?? [];
  const gl = (glRes.data ?? []) as Array<{ amount: number | string; entry_type: string }>;

  return {
    salesTopLine: sumN(sales, "total"),
    salesLineItemsSum: sumN(saleItems, "line_total"),
    refundsTopLine: sumN(refunds, "total"),
    refundItemsSum: sumN(refundItems, "line_total"),
    glSalesNet: sumGlByType(gl, "sale"),
    glRefundsNet: sumGlByType(gl, "refund"),
    counts: {
      sales: sales.length,
      saleLineItems: saleItems.length,
      refunds: refunds.length,
      refundItems: refundItems.length,
      glEntries: gl.length,
    },
  };
}

/**
 * Pure helper — exported for the property tests + the UI's delta
 * computation. Returns delta + isMatch (within ±1 cent).
 */
export interface DeltaResult {
  a: number;
  b: number;
  delta: number;
  isMatch: boolean;
}
const ONE_CENT = 0.01;
export function compareTotals(a: number, b: number): DeltaResult {
  const delta = round2(a - b);
  return { a, b, delta, isMatch: Math.abs(delta) <= ONE_CENT };
}

/**
 * Build the 4 reconciliation rows the UI displays. Pure — takes
 * totals, returns rows. Tested directly in property tests.
 */
export interface ReconciliationRow {
  label: string;
  description: string;
  expected: number;
  actual: number;
  delta: number;
  isMatch: boolean;
}
export function buildReconciliationRows(
  totals: ReconciliationTotals,
): ReconciliationRow[] {
  return [
    {
      label: "Sales top-line vs line items",
      description:
        "sum(sales.total) should equal sum(sale_items.line_total) for the period",
      expected: totals.salesTopLine,
      actual: totals.salesLineItemsSum,
      ...slice(compareTotals(totals.salesTopLine, totals.salesLineItemsSum)),
    },
    {
      label: "Refunds top-line vs line items",
      description:
        "sum(refunds.total) should equal sum(refund_items.line_total) for the period",
      expected: totals.refundsTopLine,
      actual: totals.refundItemsSum,
      ...slice(compareTotals(totals.refundsTopLine, totals.refundItemsSum)),
    },
    {
      label: "GL refunds net vs refunds top-line (negated)",
      description:
        "sum(gl_entries.amount where type='refund') should equal -1 × sum(refunds.total)",
      expected: -totals.refundsTopLine,
      actual: totals.glRefundsNet,
      ...slice(compareTotals(-totals.refundsTopLine, totals.glRefundsNet)),
    },
    {
      label: "GL sales net vs sales top-line",
      description:
        "Post-A1 only: sum(gl_entries.amount where type='sale') should equal sum(sales.total). Pre-A1 sales don't write a GL row, so the delta surfaces the unflipped tenant fraction.",
      expected: totals.salesTopLine,
      actual: totals.glSalesNet,
      ...slice(compareTotals(totals.salesTopLine, totals.glSalesNet)),
    },
  ];
}

// ─── pure helpers ──────────────────────────────────────────────────

function sumN<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return round2(
    rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0),
  );
}

function sumGlByType(
  rows: Array<{ amount: number | string; entry_type: string }>,
  type: string,
): number {
  return round2(
    rows
      .filter((r) => r.entry_type === type)
      .reduce((acc, r) => acc + Number(r.amount ?? 0), 0),
  );
}

function round2(n: number): number {
  // Round half-away-from-zero at 2 decimals to keep aggregations
  // numerically stable. Match Postgres NUMERIC(14,2) semantics.
  // The `+ 0` collapses -0 → 0 so downstream Object.is equality
  // checks (e.g. P4 reconciliation invariant) don't trip on the
  // negative-zero shim that comes out of `Math.round(-0 * 100)`.
  return Math.round(n * 100) / 100 + 0;
}

function slice(d: DeltaResult): { delta: number; isMatch: boolean } {
  return { delta: d.delta, isMatch: d.isMatch };
}
