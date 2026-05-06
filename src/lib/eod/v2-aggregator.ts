/**
 * EOD v2 aggregator — A1 C-03.
 *
 * Replaces the existing EOD path's `sum(sales.total)` + group-by-
 * payment_method shape with an aggregator that:
 *   1. Projects from `sale_items.line_total` (the canonical line-
 *      level source), NOT `sales.total`. Lines up with the
 *      reconciliation contract (H-02 / CONTRIBUTING.md §17).
 *   2. Groups by tender method, location, AND staff (the existing
 *      path only grouped by tender+location).
 *   3. Dedupes by sale.id so an unusual line-level join shape can't
 *      double-count.
 *   4. Continues to use the tenant-timezone day-boundary helper
 *      from src/app/(app)/eod/actions.ts:localDayBoundsToUtcIso —
 *      C-03's tenant-TZ requirement is already satisfied at the
 *      caller layer.
 *
 * Future-coupled to H-01 (Day 4): once `sales.completed_at` is
 * added, the aggregator can switch from `sale_date` (current) to
 * `completed_at` for tighter day-boundary semantics. Until then,
 * `sale_date` is the canonical date column.
 *
 * Caller (the existing EOD action) gates v2 on
 * `tenants.a1_money_correctness` — same column the refund
 * dispatchers + reconciliation page use.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface EODv2Range {
  startOfDayUtc: string;
  endOfDayUtc: string;
  /** Optional: filter to a single location. */
  locationId?: string | null;
}

export interface EODv2TenderTotal {
  tender: string;
  amount: number;
  saleCount: number;
}

export interface EODv2LocationTotal {
  locationId: string | null;
  total: number;
  saleCount: number;
}

export interface EODv2StaffTotal {
  staffUserId: string | null;
  staffName: string | null;
  total: number;
  saleCount: number;
}

export interface EODv2Aggregate {
  /** Sum of sale_items.line_total in range — canonical figure. */
  lineItemsTotal: number;
  /** Sum of sales.total in range — for reconciliation against lineItemsTotal. */
  salesTopLineTotal: number;
  /** Distinct sale_id count contributing to the aggregation. */
  uniqueSaleIds: number;
  byTender: EODv2TenderTotal[];
  byLocation: EODv2LocationTotal[];
  byStaff: EODv2StaffTotal[];
}

interface SaleRow {
  id: string;
  total: number | string | null;
  payment_method: string | null;
  location_id: string | null;
  created_by: string | null;
  status: string | null;
}

interface SaleItemRow {
  sale_id: string;
  line_total: number | string | null;
}

/**
 * Pure aggregator — exported for unit-test reach. Takes pre-fetched
 * rows + a name lookup, returns the EODv2Aggregate. The data fetch
 * (via Supabase) lives in the wrapper below; tests exercise the
 * pure function.
 */
export function aggregateEodV2(
  sales: SaleRow[],
  saleItems: SaleItemRow[],
  staffNameById: Map<string, string>,
): EODv2Aggregate {
  // 1. Filter sales to the canonical "EOD-included" status set
  //    (paid + completed). Existing path uses the same predicate.
  const includedSales = sales.filter(
    (s) => s.status === "paid" || s.status === "completed",
  );
  const saleIdSet = new Set(includedSales.map((s) => s.id));

  // 2. Group sale_items to those whose sale_id is in the included
  //    set. Per C-03 dedupe-by-sale.id — line items orphaned from
  //    the included sales (cancelled, voided, etc.) don't contribute.
  const includedItems = saleItems.filter((it) => saleIdSet.has(it.sale_id));

  // 3. Aggregate.
  const lineItemsTotal = round2(
    includedItems.reduce((sum, it) => sum + Number(it.line_total ?? 0), 0),
  );
  const salesTopLineTotal = round2(
    includedSales.reduce((sum, s) => sum + Number(s.total ?? 0), 0),
  );

  // by-tender: group sales by payment_method, accumulate lineItems-
  // attributed totals (NOT sales.total) so the result is consistent
  // with the canonical line-level source.
  const tenderAcc = new Map<string, { amount: number; saleIds: Set<string> }>();
  for (const sale of includedSales) {
    const tender = (sale.payment_method ?? "unknown").toLowerCase();
    if (!tenderAcc.has(tender)) {
      tenderAcc.set(tender, { amount: 0, saleIds: new Set() });
    }
    tenderAcc.get(tender)!.saleIds.add(sale.id);
  }
  // Distribute line items into tender buckets via sale_id → tender lookup.
  const saleTender = new Map<string, string>();
  for (const sale of includedSales) {
    saleTender.set(sale.id, (sale.payment_method ?? "unknown").toLowerCase());
  }
  for (const item of includedItems) {
    const tender = saleTender.get(item.sale_id);
    if (!tender) continue;
    tenderAcc.get(tender)!.amount += Number(item.line_total ?? 0);
  }
  const byTender: EODv2TenderTotal[] = Array.from(tenderAcc.entries()).map(
    ([tender, acc]) => ({
      tender,
      amount: round2(acc.amount),
      saleCount: acc.saleIds.size,
    }),
  );
  byTender.sort((a, b) => b.amount - a.amount);

  // by-location: same shape, grouped by location_id (null → "no_location").
  const locationAcc = new Map<
    string | null,
    { total: number; saleIds: Set<string> }
  >();
  const saleLocation = new Map<string, string | null>();
  for (const sale of includedSales) {
    const loc = sale.location_id ?? null;
    if (!locationAcc.has(loc)) {
      locationAcc.set(loc, { total: 0, saleIds: new Set() });
    }
    locationAcc.get(loc)!.saleIds.add(sale.id);
    saleLocation.set(sale.id, loc);
  }
  for (const item of includedItems) {
    const loc = saleLocation.get(item.sale_id);
    if (loc === undefined) continue;
    locationAcc.get(loc)!.total += Number(item.line_total ?? 0);
  }
  const byLocation: EODv2LocationTotal[] = Array.from(locationAcc.entries()).map(
    ([locationId, acc]) => ({
      locationId,
      total: round2(acc.total),
      saleCount: acc.saleIds.size,
    }),
  );
  byLocation.sort((a, b) => b.total - a.total);

  // by-staff: created_by is the staff user_id; lookup name via the
  // caller-provided map (avoids per-row joins in the aggregator).
  const staffAcc = new Map<
    string | null,
    { total: number; saleIds: Set<string> }
  >();
  const saleStaff = new Map<string, string | null>();
  for (const sale of includedSales) {
    const staff = sale.created_by ?? null;
    if (!staffAcc.has(staff)) {
      staffAcc.set(staff, { total: 0, saleIds: new Set() });
    }
    staffAcc.get(staff)!.saleIds.add(sale.id);
    saleStaff.set(sale.id, staff);
  }
  for (const item of includedItems) {
    const staff = saleStaff.get(item.sale_id);
    if (staff === undefined) continue;
    staffAcc.get(staff)!.total += Number(item.line_total ?? 0);
  }
  const byStaff: EODv2StaffTotal[] = Array.from(staffAcc.entries()).map(
    ([staffUserId, acc]) => ({
      staffUserId,
      staffName: staffUserId ? staffNameById.get(staffUserId) ?? null : null,
      total: round2(acc.total),
      saleCount: acc.saleIds.size,
    }),
  );
  byStaff.sort((a, b) => b.total - a.total);

  return {
    lineItemsTotal,
    salesTopLineTotal,
    uniqueSaleIds: saleIdSet.size,
    byTender,
    byLocation,
    byStaff,
  };
}

/**
 * Wrapper around aggregateEodV2 that does the Supabase fetches.
 * Caller passes pre-computed UTC range (from
 * localDayBoundsToUtcIso). Returns the same EODv2Aggregate shape.
 */
export async function getEodV2(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, "public", any>,
  tenantId: string,
  range: EODv2Range,
): Promise<EODv2Aggregate> {
  // Fetch in parallel: sales + sale_items + staff names (for byStaff
  // labels).
  let salesQ = admin
    .from("sales")
    .select("id, total, payment_method, location_id, created_by, status")
    .eq("tenant_id", tenantId)
    .gte("sale_date", range.startOfDayUtc)
    .lte("sale_date", range.endOfDayUtc)
    .in("status", ["paid", "completed"]);
  if (range.locationId) salesQ = salesQ.eq("location_id", range.locationId);

  const { data: sales } = await salesQ;
  const salesList = (sales ?? []) as SaleRow[];

  // sale_items joined to those sales by sale_id. Two-step fetch is
  // simpler than relying on PostgREST embeds for line items.
  const saleIds = salesList.map((s) => s.id);
  const itemsList: SaleItemRow[] = saleIds.length
    ? (
        await admin
          .from("sale_items")
          .select("sale_id, line_total")
          .in("sale_id", saleIds)
      ).data ?? []
    : [];

  const staffIds = Array.from(
    new Set(salesList.map((s) => s.created_by).filter(Boolean) as string[]),
  );
  const staffNameById = new Map<string, string>();
  if (staffIds.length) {
    const { data: members } = await admin
      .from("team_members")
      .select("user_id, name")
      .in("user_id", staffIds)
      .eq("tenant_id", tenantId);
    for (const m of members ?? []) {
      if (m.user_id && m.name) staffNameById.set(m.user_id, m.name);
    }
  }

  return aggregateEodV2(salesList, itemsList, staffNameById);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100 + 0;
}
