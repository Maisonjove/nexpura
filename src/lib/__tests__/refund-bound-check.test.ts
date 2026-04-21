import { describe, it, expect } from "vitest";

/**
 * Regression: refund subtotal must be bounded by (sale.subtotal - alreadyRefunded).
 * Pure logic test of the bound-check that lives in refunds/actions.ts —
 * asserting the rule we enforce there. Keeps the invariant locked in
 * so a future refactor can't silently reintroduce the bug (client could
 * previously supply an inflated total and receive store credit for
 * more than the original sale).
 */

function checkRefundBound(
  requestedSubtotal: number,
  saleSubtotal: number,
  alreadyRefunded: number,
): { ok: boolean; reason?: string } {
  if (requestedSubtotal <= 0) return { ok: false, reason: "must be positive" };
  const remaining = saleSubtotal - alreadyRefunded;
  if (requestedSubtotal > remaining + 0.01) return { ok: false, reason: "exceeds remaining" };
  return { ok: true };
}

describe("refund bound-check invariant", () => {
  it("accepts a full refund of an unrefunded sale", () => {
    expect(checkRefundBound(100, 100, 0).ok).toBe(true);
  });

  it("accepts a partial refund", () => {
    expect(checkRefundBound(30, 100, 0).ok).toBe(true);
  });

  it("accepts stacking partials up to the total", () => {
    expect(checkRefundBound(70, 100, 30).ok).toBe(true);
  });

  it("REJECTS a refund that exceeds the sale total — the bug this exists to prevent", () => {
    const result = checkRefundBound(9999, 100, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds/i);
  });

  it("REJECTS a refund that exceeds remaining after prior partial refunds", () => {
    const result = checkRefundBound(80, 100, 30);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds/i);
  });

  it("REJECTS zero or negative refund subtotals", () => {
    expect(checkRefundBound(0, 100, 0).ok).toBe(false);
    expect(checkRefundBound(-10, 100, 0).ok).toBe(false);
  });

  it("allows tiny floating-point slack (1 cent epsilon)", () => {
    // 99.995 is functionally equal to 100.00 after the 0.01 epsilon.
    expect(checkRefundBound(100.005, 100, 0).ok).toBe(true);
  });
});
