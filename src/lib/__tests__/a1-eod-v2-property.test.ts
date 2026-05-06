/**
 * A1 Day 3 — EOD v2 aggregator invariants.
 *
 * Property-style tests on the pure aggregateEodV2 helper. The
 * Supabase wrapper getEodV2 is exercised end-to-end in Day 5 deploy
 * soak; here we cover the aggregation logic itself.
 *
 * 5 invariants:
 *   E1: Sum of byTender amounts == lineItemsTotal (canonical
 *       distribution invariant).
 *   E2: Sum of byLocation totals == lineItemsTotal (same partition,
 *       different group).
 *   E3: Sum of byStaff totals == lineItemsTotal (same partition,
 *       different group).
 *   E4: uniqueSaleIds == count of sales with status='paid' or
 *       'completed' (dedupe by sale.id).
 *   E5: Cancelled / voided sales (status='cancelled', etc.)
 *       contribute 0 to all totals + counts.
 */
import { describe, it, expect } from "vitest";
import { aggregateEodV2 } from "../eod/v2-aggregator";

interface SaleRow {
  id: string;
  total: number | string | null;
  payment_method: string | null;
  location_id: string | null;
  created_by: string | null;
  status: string | null;
}
interface ItemRow {
  sale_id: string;
  line_total: number | string | null;
}

const FUZZ_RUNS = 100;

function randomShape(): { sales: SaleRow[]; items: ItemRow[] } {
  const saleCount = 3 + Math.floor(Math.random() * 12);
  const sales: SaleRow[] = [];
  const items: ItemRow[] = [];
  const tenders = ["cash", "card", "transfer", "voucher"];
  const locations = ["loc-A", "loc-B", null];
  const staff = ["user-1", "user-2", "user-3", null];
  for (let i = 0; i < saleCount; i++) {
    const id = `sale-${i}`;
    const status =
      Math.random() < 0.85 ? (Math.random() < 0.5 ? "paid" : "completed")
      : Math.random() < 0.5 ? "cancelled" : "refunded";
    sales.push({
      id,
      total: Math.round(Math.random() * 50000) / 100,
      payment_method: tenders[Math.floor(Math.random() * tenders.length)],
      location_id: locations[Math.floor(Math.random() * locations.length)],
      created_by: staff[Math.floor(Math.random() * staff.length)],
      status,
    });
    const itemCount = 1 + Math.floor(Math.random() * 4);
    for (let j = 0; j < itemCount; j++) {
      items.push({
        sale_id: id,
        line_total: Math.round(Math.random() * 20000) / 100,
      });
    }
  }
  return { sales, items };
}

const APPROX_EPS = 0.05;

describe("aggregateEodV2 — partition invariants", () => {
  it("E1: sum(byTender.amount) == lineItemsTotal (within rounding)", () => {
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const { sales, items } = randomShape();
      const agg = aggregateEodV2(sales, items, new Map());
      const tenderSum = agg.byTender.reduce((a, t) => a + t.amount, 0);
      expect(Math.abs(tenderSum - agg.lineItemsTotal)).toBeLessThanOrEqual(APPROX_EPS);
    }
  });

  it("E2: sum(byLocation.total) == lineItemsTotal", () => {
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const { sales, items } = randomShape();
      const agg = aggregateEodV2(sales, items, new Map());
      const locSum = agg.byLocation.reduce((a, l) => a + l.total, 0);
      expect(Math.abs(locSum - agg.lineItemsTotal)).toBeLessThanOrEqual(APPROX_EPS);
    }
  });

  it("E3: sum(byStaff.total) == lineItemsTotal", () => {
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const { sales, items } = randomShape();
      const agg = aggregateEodV2(sales, items, new Map());
      const staffSum = agg.byStaff.reduce((a, s) => a + s.total, 0);
      expect(Math.abs(staffSum - agg.lineItemsTotal)).toBeLessThanOrEqual(APPROX_EPS);
    }
  });
});

describe("aggregateEodV2 — included-status invariants", () => {
  it("E4: uniqueSaleIds == count of sales with status='paid' or 'completed'", () => {
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const { sales, items } = randomShape();
      const agg = aggregateEodV2(sales, items, new Map());
      const expected = sales.filter(
        (s) => s.status === "paid" || s.status === "completed",
      ).length;
      expect(agg.uniqueSaleIds).toBe(expected);
    }
  });

  it("E5: cancelled/refunded/quote sales contribute 0 to all totals", () => {
    // Construct a fully-cancelled set: no included sale should
    // produce any line-item attribution.
    const sales: SaleRow[] = [
      {
        id: "s1",
        total: 100,
        payment_method: "cash",
        location_id: "loc-A",
        created_by: "user-1",
        status: "cancelled",
      },
      {
        id: "s2",
        total: 50,
        payment_method: "card",
        location_id: "loc-B",
        created_by: "user-2",
        status: "refunded",
      },
      {
        id: "s3",
        total: 25,
        payment_method: "cash",
        location_id: null,
        created_by: null,
        status: "quote",
      },
    ];
    const items: ItemRow[] = [
      { sale_id: "s1", line_total: 100 },
      { sale_id: "s2", line_total: 50 },
      { sale_id: "s3", line_total: 25 },
    ];
    const agg = aggregateEodV2(sales, items, new Map());
    expect(agg.lineItemsTotal).toBe(0);
    expect(agg.salesTopLineTotal).toBe(0);
    expect(agg.uniqueSaleIds).toBe(0);
    expect(agg.byTender.length).toBe(0);
    expect(agg.byLocation.length).toBe(0);
    expect(agg.byStaff.length).toBe(0);
  });
});

describe("aggregateEodV2 — dedupe by sale.id", () => {
  it("orphan line items (sale_id not in sales) contribute 0", () => {
    const sales: SaleRow[] = [
      {
        id: "s1",
        total: 100,
        payment_method: "cash",
        location_id: null,
        created_by: null,
        status: "paid",
      },
    ];
    const items: ItemRow[] = [
      { sale_id: "s1", line_total: 100 },
      { sale_id: "ghost-sale", line_total: 999_999 }, // orphan
    ];
    const agg = aggregateEodV2(sales, items, new Map());
    expect(agg.lineItemsTotal).toBe(100); // ghost ignored
  });
});

describe("aggregateEodV2 — staff name lookup", () => {
  it("populates staffName from the lookup map (null when missing)", () => {
    const sales: SaleRow[] = [
      {
        id: "s1",
        total: 50,
        payment_method: "cash",
        location_id: null,
        created_by: "user-named",
        status: "paid",
      },
      {
        id: "s2",
        total: 30,
        payment_method: "cash",
        location_id: null,
        created_by: "user-anon",
        status: "paid",
      },
    ];
    const items: ItemRow[] = [
      { sale_id: "s1", line_total: 50 },
      { sale_id: "s2", line_total: 30 },
    ];
    const agg = aggregateEodV2(
      sales,
      items,
      new Map([["user-named", "Alice"]]),
    );
    const aliceRow = agg.byStaff.find((s) => s.staffUserId === "user-named");
    const anonRow = agg.byStaff.find((s) => s.staffUserId === "user-anon");
    expect(aliceRow?.staffName).toBe("Alice");
    expect(anonRow?.staffName).toBe(null);
  });
});
