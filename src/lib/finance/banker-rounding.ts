/**
 * Banker's rounding (round half to even) — A1 M-01.
 *
 * Default Math.round() in JS uses "round half away from zero" — so
 * 0.5 → 1, 1.5 → 2, 2.5 → 3, 3.5 → 4. This biases sums upward
 * because the half-cases all round up. Over millions of POS line
 * items, the bias accumulates into real money drift.
 *
 * Banker's rounding (round half to even) instead rounds 0.5 to the
 * nearest EVEN integer:
 *   0.5 → 0, 1.5 → 2, 2.5 → 2, 3.5 → 4
 *
 * Halfway cases distribute evenly between rounding up vs down, so
 * the long-run aggregate bias is ~0. This is the standard for
 * financial systems (IEEE 754 default, IRS rounding, GAAP, etc.).
 *
 * APPLIED AT LINE LEVEL — NOT AT SUBTOTAL
 *
 * Pre-fix the POS computed `subtotal × tax_rate` once at the cart
 * level, then rounded. That's correct algorithmically but the line
 * receipts and the GL entries don't add up to the rounded total
 * within ±1¢ for receipts that have many lines, because each line's
 * implied tax is `line_total × tax_rate / (1 + tax_rate)` (or
 * similar) and the per-line rounding errors don't cancel.
 *
 * Post-fix M-01: tax rounding fires at line level. Each line's
 * tax_amount is banker-rounded at write. Sum of line tax_amounts ==
 * subtotal × tax_rate (within ±1¢ over any cart shape) — pinned by
 * the property test in src/lib/__tests__/a1-banker-rounding-property.test.ts.
 */

/**
 * Round to 2 decimal places using banker's rounding. Stable for
 * NUMERIC(N,2) Postgres column round-trips.
 */
export function bankersRound2(value: number): number {
  // Scale to integer cents to avoid floating-point seam issues.
  const scaled = value * 100;
  const floor = Math.floor(scaled);
  const frac = scaled - floor;

  // Tolerance for "is this exactly 0.5?" — JS floats don't store
  // 0.1 exactly, so we need a small epsilon.
  const HALF_EPS = 1e-9;

  if (Math.abs(frac - 0.5) < HALF_EPS) {
    // Halfway case: pick the EVEN neighbour.
    return (floor % 2 === 0 ? floor : floor + 1) / 100;
  }

  // Not halfway — standard rounding. Math.round is fine since the
  // bias only matters at the exact 0.5 case.
  return Math.round(scaled) / 100 + 0; // `+ 0` collapses -0 → 0
}

/**
 * Compute the GST/VAT/sales-tax for a single line item at the given
 * tax rate. Banker-rounded at the line so per-line totals are
 * cumulative-sum-stable.
 *
 * Convention: tax is added on top (subtotal + tax = total). For
 * tax-inclusive pricing, the caller pre-computes tax_amount =
 * line_total - line_total / (1 + tax_rate) and feeds the result
 * through bankersRound2.
 */
export function lineTaxAmount(
  lineSubtotal: number,
  taxRate: number,
): number {
  return bankersRound2(lineSubtotal * taxRate);
}

/**
 * Sum a list of line items, applying banker's rounding to each
 * line's tax computation. Returns { subtotal, taxAmount, total }.
 * The subtotal is summed exact (no rounding); the taxAmount is sum-
 * of-banker-rounded-line-taxes; the total is subtotal + taxAmount.
 *
 * The cumulative sum invariant (M-01): for any cart shape with
 * positive line totals, the sum of line tax amounts is within ±1¢
 * of `subtotal × taxRate` rounded. Pinned by property test.
 */
export interface CartLine {
  lineTotal: number;
}
export interface CartTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}
export function sumCartWithLineTax(
  lines: CartLine[],
  taxRate: number,
): CartTotals {
  let subtotal = 0;
  let taxAmount = 0;
  for (const l of lines) {
    subtotal += l.lineTotal;
    taxAmount += lineTaxAmount(l.lineTotal, taxRate);
  }
  // Round subtotal + taxAmount independently for NUMERIC(14,2)
  // column safety. Total is the sum (no extra rounding seam).
  subtotal = bankersRound2(subtotal);
  taxAmount = bankersRound2(taxAmount);
  return { subtotal, taxAmount, total: bankersRound2(subtotal + taxAmount) };
}
