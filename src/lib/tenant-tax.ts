import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantTaxConfig {
  tax_rate: number;
  tax_name: string;
  tax_inclusive: boolean;
}

/**
 * Fetch tax configuration for a tenant from the tenants table.
 * Defaults: tax_rate=0.1 (10% GST), tax_name="GST", tax_inclusive=true
 */
export async function getTenantTaxConfig(tenantId: string): Promise<TenantTaxConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("tax_rate, tax_name, tax_inclusive")
    .eq("id", tenantId)
    .single();

  return {
    tax_rate: data?.tax_rate ?? 0.1,
    tax_name: data?.tax_name || "GST",
    tax_inclusive: data?.tax_inclusive ?? true,
  };
}

export interface MoneyLineItem {
  quantity: number;
  unit_price: number;
  discount_pct?: number;
}

export interface MoneyTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
  lineTotals: number[]; // server-authoritative per-line totals
}

/**
 * Server-authoritative recompute of subtotal / tax / total from line items.
 * Kept in sync with invoices/actions.ts::calcTotals so every money-moving
 * surface (POS, laybys, sales, quotes, invoices) rounds identically.
 *
 * W3-CRIT-04: closes the till-shortfall hole where server actions trusted
 * a client-supplied `total` / `line_total`. Never pass client totals to
 * a DB insert — recompute here, compare to the client's claim, reject on
 * divergence so an inflated cart can't record a $5 sale for a $5000 item.
 *
 * Semantics match calcTotals:
 *  - lineTotal per item = quantity * unit_price * (1 - discount_pct/100)
 *  - if tax_inclusive: lineTotal is gross; tax is extracted from (sum - discount)
 *  - else: lineTotal is net; tax added on top of (sum - discount)
 *  - discount is clamped 0..lineSum by the caller (see clampDiscount)
 *  - all outputs rounded to 2dp (cents)
 */
export function computeMoneyTotals(
  items: MoneyLineItem[],
  taxRate: number,
  taxInclusive: boolean,
  discountAmount: number
): MoneyTotals {
  // Per-line totals are rounded for DB insertion (sale_items.line_total
  // is currency). The *sum*, however, uses unrounded line values so
  // subtotal / tax / total match calcTotals(invoices) byte-for-byte and
  // we don't trip the 0.01 mismatch gate on accumulated rounding error.
  const lineTotals = items.map((item) => {
    const disc = item.discount_pct ? item.discount_pct / 100 : 0;
    return Math.round(item.quantity * item.unit_price * (1 - disc) * 100) / 100;
  });
  const lineSum = items.reduce((acc, item) => {
    const disc = item.discount_pct ? item.discount_pct / 100 : 0;
    return acc + item.quantity * item.unit_price * (1 - disc);
  }, 0);

  let subtotal: number;
  let taxAmount: number;
  let total: number;

  if (taxInclusive) {
    total = lineSum - discountAmount;
    taxAmount = total - total / (1 + taxRate);
    subtotal = total - taxAmount;
  } else {
    subtotal = lineSum;
    taxAmount = (subtotal - discountAmount) * taxRate;
    total = subtotal - discountAmount + taxAmount;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    lineTotals,
  };
}

/**
 * Clamp a staff-entered absolute discount to [0, subtotal]. Negative
 * discounts can't exist; a discount larger than the cart zeroes the bill
 * rather than producing a negative total the DB would happily store.
 */
export function clampDiscount(discount: number, subtotal: number): number {
  if (!isFinite(discount) || discount <= 0) return 0;
  return Math.min(discount, subtotal);
}
