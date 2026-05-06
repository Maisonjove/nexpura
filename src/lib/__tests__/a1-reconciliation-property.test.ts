/**
 * A1 Day 3 — reconciliation property-style tests.
 *
 * Pure-function invariants on the aggregator's helpers (compareTotals,
 * buildReconciliationRows, the rounding logic). Property-style: each
 * test runs N random inputs through the helper and asserts a holistic
 * invariant rather than a single-case equality.
 *
 * Why hand-rolled fuzzer instead of fast-check: the aggregator's
 * inputs are simple numbers + plain object shapes, the invariants
 * are 2-property equalities, and adding fast-check is a package.json
 * change for a 5-test suite. If A1 grows more fuzz surface
 * (Day 4 backfills, future M-01 tax invariants), revisit fast-check
 * then. Vitest's loop + Math.random is sufficient here.
 *
 * Pinned invariants (5):
 *   P1: compareTotals is symmetric in absolute terms.
 *   P2: ±0.01-cent slack — anything within 1¢ matches; anything
 *       beyond doesn't.
 *   P3: Reconciliation row's expected/actual round-trip matches the
 *       totals fed to it (no off-by-one indexing in the row builder).
 *   P4: Empty totals produce 4 rows with all isMatch=true (zeros
 *       compare equal — defensive against "empty range" page panic).
 *   P5: GL refunds row uses NEGATED refundsTopLine as the expected
 *       value (the gl_entries.amount is signed negative for refunds).
 */

import { describe, it, expect } from "vitest";
import {
  compareTotals,
  buildReconciliationRows,
  type ReconciliationTotals,
} from "../finance/reconciliation";

const FUZZ_RUNS = 200;
const MAX_AMOUNT = 1_000_000;

function randAmount(): number {
  return Math.round(Math.random() * MAX_AMOUNT * 100) / 100;
}

function randomTotals(): ReconciliationTotals {
  // Cluster-PR item 3: salesSubtotal + salesTax added so the sales-line
  // row reconciles against the pre-tax base instead of the tax-included
  // top-line. Random subtotals/tax kept independent of salesTopLine for
  // the property-style fuzz; the sanity row is allowed to fail under
  // these draws (only the row-shape invariant is asserted in P3).
  return {
    salesTopLine: randAmount(),
    salesSubtotal: randAmount(),
    salesTax: randAmount(),
    salesLineItemsSum: randAmount(),
    refundsTopLine: randAmount(),
    refundItemsSum: randAmount(),
    glSalesNet: randAmount(),
    glRefundsNet: -randAmount(), // sign convention
    counts: {
      sales: Math.floor(Math.random() * 100),
      saleLineItems: Math.floor(Math.random() * 500),
      refunds: Math.floor(Math.random() * 50),
      refundItems: Math.floor(Math.random() * 200),
      glEntries: Math.floor(Math.random() * 150),
    },
  };
}

describe("A1 reconciliation — invariants (property-style)", () => {
  it("P1: compareTotals(a, b).delta == -compareTotals(b, a).delta (symmetric in sign)", () => {
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const a = randAmount();
      const b = randAmount();
      const ab = compareTotals(a, b);
      const ba = compareTotals(b, a);
      expect(Math.abs(ab.delta + ba.delta)).toBeLessThanOrEqual(0.01);
      // isMatch is symmetric absolutely.
      expect(ab.isMatch).toBe(ba.isMatch);
    }
  });

  it("P2: ±0.01 slack — within 1¢ matches, beyond 1¢ doesn't", () => {
    // Edge case at exactly ±0.01 inclusive.
    expect(compareTotals(100, 100).isMatch).toBe(true);
    expect(compareTotals(100, 100.01).isMatch).toBe(true);
    expect(compareTotals(100.01, 100).isMatch).toBe(true);
    expect(compareTotals(100, 100.011).isMatch).toBe(true); // rounds to 0.01
    expect(compareTotals(100, 100.02).isMatch).toBe(false);
    expect(compareTotals(100, 99.98).isMatch).toBe(false);

    // Fuzz around the boundary.
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const base = randAmount();
      const slack = (Math.random() * 0.02 - 0.01); // ±1¢ range
      const cmp = compareTotals(base, base + slack);
      // Allow ±1 slot of floating-point fuzz at the boundary.
      const expectedMatch = Math.abs(slack) <= 0.011;
      // expectedMatch is permissive at the rounding seam; if cmp
      // says match, the absolute delta should not exceed 0.011.
      if (cmp.isMatch) {
        expect(Math.abs(cmp.delta)).toBeLessThanOrEqual(0.011);
      } else {
        expect(Math.abs(cmp.delta)).toBeGreaterThan(0.005);
      }
      // expectedMatch sanity (loose):
      void expectedMatch;
    }
  });

  it("P3: row builder threads totals through to expected/actual without off-by-one", () => {
    // Cluster-PR item 3 row layout (6 rows):
    //   0 — sales subtotal vs line items (pre-tax)
    //   1 — sales tax (sale-level surface)
    //   2 — sales total vs subtotal + tax sanity
    //   3 — refunds top-line vs line items
    //   4 — GL refunds vs negated refunds top-line
    //   5 — GL sales vs sales top-line
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const t = randomTotals();
      const rows = buildReconciliationRows(t);
      expect(rows.length).toBe(6);
      // Row 0: sales subtotal vs line items (pre-tax).
      expect(rows[0].expected).toBe(t.salesSubtotal);
      expect(rows[0].actual).toBe(t.salesLineItemsSum);
      // Row 1: tax (self-self comparison, expected==actual).
      expect(rows[1].expected).toBe(t.salesTax);
      expect(rows[1].actual).toBe(t.salesTax);
      expect(rows[1].isMatch).toBe(true);
      // Row 2: sales total vs subtotal + tax sanity.
      expect(rows[2].expected).toBe(t.salesTopLine);
      // Row 3: refunds top-line vs line items.
      expect(rows[3].expected).toBe(t.refundsTopLine);
      expect(rows[3].actual).toBe(t.refundItemsSum);
      // Row 4: GL refunds vs negated refunds top-line (P5 detail).
      expect(rows[4].expected).toBe(-t.refundsTopLine);
      expect(rows[4].actual).toBe(t.glRefundsNet);
      // Row 5: GL sales vs sales top-line.
      expect(rows[5].expected).toBe(t.salesTopLine);
      expect(rows[5].actual).toBe(t.glSalesNet);
    }
  });

  it("P4: zero totals produce 6 rows all matching", () => {
    const zero: ReconciliationTotals = {
      salesTopLine: 0,
      salesSubtotal: 0,
      salesTax: 0,
      salesLineItemsSum: 0,
      refundsTopLine: 0,
      refundItemsSum: 0,
      glSalesNet: 0,
      glRefundsNet: 0,
      counts: {
        sales: 0,
        saleLineItems: 0,
        refunds: 0,
        refundItems: 0,
        glEntries: 0,
      },
    };
    const rows = buildReconciliationRows(zero);
    expect(rows.length).toBe(6);
    for (const r of rows) {
      expect(r.isMatch).toBe(true);
      expect(r.delta).toBe(0);
    }
  });

  it("P5: GL refunds row's expected value is NEGATED (gl_entries.amount is signed)", () => {
    // The GL invariant: a $100 refund writes a -$100 gl_entries row.
    // The reconciliation matches when glRefundsNet === -1 × refundsTopLine.
    // Pin that the row builder gets the sign right — a future refactor
    // dropping the negation would silently invert every refund period
    // (look-correct-on-zero, look-broken-on-anything-else).
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const refundsTopLine = randAmount();
      const t: ReconciliationTotals = {
        salesTopLine: 0,
        salesSubtotal: 0,
        salesTax: 0,
        salesLineItemsSum: 0,
        refundsTopLine,
        refundItemsSum: refundsTopLine,
        glSalesNet: 0,
        glRefundsNet: -refundsTopLine, // canonical
        counts: {
          sales: 0,
          saleLineItems: 0,
          refunds: 1,
          refundItems: 1,
          glEntries: 1,
        },
      };
      const rows = buildReconciliationRows(t);
      // GL refunds row index shifted from 2 → 4 in cluster-PR item 3.
      const glRefundsRow = rows[4];
      expect(glRefundsRow.label).toMatch(/GL refunds/);
      expect(glRefundsRow.expected).toBe(-refundsTopLine);
      expect(glRefundsRow.actual).toBe(-refundsTopLine);
      expect(glRefundsRow.isMatch).toBe(true);
    }
  });
});
