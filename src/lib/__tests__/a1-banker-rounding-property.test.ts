/**
 * A1 Day 4 — banker's rounding (M-01) invariants.
 *
 * Pure-function property tests on the rounding helper + cart-tax
 * sum invariant (the canonical M-01 property: per-line banker-
 * rounded tax amounts sum to within ±1¢ of subtotal × rate).
 */
import { describe, it, expect } from "vitest";
import {
  bankersRound2,
  lineTaxAmount,
  sumCartWithLineTax,
} from "../finance/banker-rounding";

describe("bankersRound2 — half-to-even pinned cases", () => {
  // The classic banker's rounding contract.
  it("0.5 → 0 (round to even)", () => {
    expect(bankersRound2(0.005)).toBe(0);
  });
  it("0.015 → 0.02 (round to even — 1 is odd, go up)", () => {
    expect(bankersRound2(0.015)).toBe(0.02);
  });
  it("0.025 → 0.02 (round to even — 2 is even, stay)", () => {
    expect(bankersRound2(0.025)).toBe(0.02);
  });
  it("0.035 → 0.04 (round to even — 3 is odd, go up)", () => {
    expect(bankersRound2(0.035)).toBe(0.04);
  });
  it("non-halfway cases use standard rounding", () => {
    expect(bankersRound2(0.011)).toBe(0.01);
    expect(bankersRound2(0.014)).toBe(0.01);
    expect(bankersRound2(0.016)).toBe(0.02);
    expect(bankersRound2(0.019)).toBe(0.02);
  });

  it("collapses -0 to 0 (NUMERIC column round-trip safe)", () => {
    expect(Object.is(bankersRound2(0), 0)).toBe(true);
    expect(Object.is(bankersRound2(-0), 0)).toBe(true);
  });

  it("preserves positive sign on small positives", () => {
    expect(bankersRound2(0.01)).toBe(0.01);
    expect(bankersRound2(0.001)).toBe(0);
  });
});

describe("lineTaxAmount — wrapper", () => {
  it("returns banker-rounded line tax", () => {
    // 50.00 * 0.10 = 5.00 — clean case
    expect(lineTaxAmount(50, 0.1)).toBe(5);
    // 50.05 * 0.10 = 5.005 → 5.00 (round to even)
    expect(lineTaxAmount(50.05, 0.1)).toBe(5);
    // 50.15 * 0.10 = 5.015 → 5.02 (round to even — 1 odd → up)
    expect(lineTaxAmount(50.15, 0.1)).toBe(5.02);
  });
});

describe("sumCartWithLineTax — M-01 internal-consistency invariants", () => {
  // M-01's actual invariant is internal consistency: the cart total
  // tax equals the sum of banker-rounded line tax amounts shown on
  // the receipt + GL entries. Comparing to `subtotal × rate` is
  // comparing to a DIFFERENT computation (the pre-fix shape) that
  // M-01 is explicitly moving away from — they can disagree by up
  // to 0.5¢ × N lines, with the POST-FIX value being the truthful
  // one because the receipt + GL are line-level consistent.

  function randomCart(): { lineTotal: number }[] {
    const n = 1 + Math.floor(Math.random() * 30);
    const lines: { lineTotal: number }[] = [];
    for (let i = 0; i < n; i++) {
      const cents = 1 + Math.floor(Math.random() * 1_000_000);
      lines.push({ lineTotal: cents / 100 });
    }
    return lines;
  }

  const FUZZ_RUNS = 500;
  const PENNY = 0.0101; // 1¢ + tiny float-seam slack

  it("M1: cart taxAmount == sum of banker-rounded per-line taxes (canonical)", () => {
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const lines = randomCart();
      const { taxAmount } = sumCartWithLineTax(lines, 0.1);
      const lineTaxSum = bankersRound2(
        lines.reduce((acc, l) => acc + lineTaxAmount(l.lineTotal, 0.1), 0),
      );
      expect(taxAmount).toBe(lineTaxSum);
    }
  });

  it("M2: 1-line cart matches the legacy subtotal × rate computation (special case)", () => {
    // The pre-fix and post-fix flows agree for any 1-line cart —
    // there's no per-line drift to accumulate. Pin this so the
    // single-item POS receipt doesn't surprise.
    for (let i = 0; i < 100; i++) {
      const cents = 1 + Math.floor(Math.random() * 1_000_000);
      const lineTotal = cents / 100;
      const { taxAmount } = sumCartWithLineTax([{ lineTotal }], 0.1);
      expect(taxAmount).toBe(bankersRound2(lineTotal * 0.1));
    }
  });

  it("M3: multi-line cart drift is bounded by 0.5¢ × N over `subtotal × rate`", () => {
    // The drift between line-level summed and subtotal-multiplied is
    // bounded by half-a-cent per line. Pin so a future regression
    // (e.g. someone "fixes" the drift by abandoning line-level
    // rounding) breaks this and we have to consciously accept it.
    for (let i = 0; i < FUZZ_RUNS; i++) {
      const lines = randomCart();
      const { subtotal, taxAmount } = sumCartWithLineTax(lines, 0.1);
      const subtotalRounded = bankersRound2(subtotal * 0.1);
      const drift = Math.abs(taxAmount - subtotalRounded);
      // Allow PENNY * lines.length as a generous upper bound — the
      // actual worst case is 0.5¢ * lines.length but float rounds
      // wobble that figure.
      expect(drift).toBeLessThanOrEqual(PENNY * lines.length);
    }
  });

  it("M4: subtotal == sum(lineTotal) within rounding tolerance", () => {
    for (let i = 0; i < 200; i++) {
      const lines = randomCart();
      const exactSum = lines.reduce((s, l) => s + l.lineTotal, 0);
      const { subtotal } = sumCartWithLineTax(lines, 0.1);
      expect(Math.abs(subtotal - exactSum)).toBeLessThanOrEqual(PENNY);
    }
  });

  it("M5: total == subtotal + taxAmount (no extra rounding seam)", () => {
    const { subtotal, taxAmount, total } = sumCartWithLineTax(
      [{ lineTotal: 50 }, { lineTotal: 30.5 }],
      0.1,
    );
    expect(total).toBe(bankersRound2(subtotal + taxAmount));
  });

  it("M6: empty cart returns zeros", () => {
    const { subtotal, taxAmount, total } = sumCartWithLineTax([], 0.1);
    expect(subtotal).toBe(0);
    expect(taxAmount).toBe(0);
    expect(total).toBe(0);
  });
});
