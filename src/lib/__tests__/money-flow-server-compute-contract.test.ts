import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeMoneyTotals, clampDiscount } from "../tenant-tax";

/**
 * Regression contract for W3-CRIT-04 — money-flow holes where server
 * actions accepted client-supplied totals / line_totals instead of
 * recomputing them. A malicious client or a React state bug could
 * previously record a $5 sale for a $5000 item (till shortfall).
 *
 * Four surfaces were hardened:
 *   (A) pos/actions.ts::createPOSSale
 *   (B) pos/actions.ts::createLaybySale
 *   (C) sales/actions.ts::createSale
 *   (D) quotes/actions-server.ts::createQuote + convertQuoteToInvoice
 *
 * These are lock-tests: they grep the source to assert the bug pattern
 * is gone AND the fix pattern is present. Any future edit that
 * re-introduces trusting a client-supplied `total` / `line_total` on
 * these hot paths breaks CI. Same static-analysis style as
 * receipt-branding-xss-contract.test.ts.
 */

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

// ─── Primitive helper tests: computeMoneyTotals / clampDiscount ───────────
describe("computeMoneyTotals — shared money recompute primitive", () => {
  it("exclusive tax: adds tax on top of subtotal", () => {
    const out = computeMoneyTotals(
      [{ quantity: 2, unit_price: 50 }],
      0.1,
      false,
      0
    );
    expect(out.subtotal).toBe(100);
    expect(out.taxAmount).toBe(10);
    expect(out.total).toBe(110);
    expect(out.lineTotals).toEqual([100]);
  });

  it("inclusive tax: extracts tax from the gross line total", () => {
    // gross = 110, net = 100, tax = 10
    const out = computeMoneyTotals(
      [{ quantity: 1, unit_price: 110 }],
      0.1,
      true,
      0
    );
    expect(out.total).toBe(110);
    expect(out.taxAmount).toBeCloseTo(10, 2);
    expect(out.subtotal).toBeCloseTo(100, 2);
  });

  it("applies per-line discount_pct correctly", () => {
    const out = computeMoneyTotals(
      [{ quantity: 1, unit_price: 100, discount_pct: 20 }],
      0.1,
      false,
      0
    );
    expect(out.lineTotals).toEqual([80]);
    expect(out.subtotal).toBe(80);
    expect(out.total).toBeCloseTo(88, 2);
  });

  it("exclusive: absolute discount reduces taxable amount", () => {
    const out = computeMoneyTotals(
      [{ quantity: 1, unit_price: 100 }],
      0.1,
      false,
      10
    );
    // subtotal=100, discount=10, taxable=90, tax=9, total=99
    expect(out.subtotal).toBe(100);
    expect(out.taxAmount).toBe(9);
    expect(out.total).toBe(99);
  });

  it("rounds outputs to 2dp (cents)", () => {
    const out = computeMoneyTotals(
      [{ quantity: 3, unit_price: 10.333 }],
      0.1,
      false,
      0
    );
    // 3 * 10.333 = 30.999, tax 3.0999, total 34.0989 → rounds cleanly
    expect(Number.isInteger(out.subtotal * 100)).toBe(true);
    expect(Number.isInteger(out.taxAmount * 100)).toBe(true);
    expect(Number.isInteger(out.total * 100)).toBe(true);
  });
});

describe("clampDiscount — staff-entered absolute discount guard", () => {
  it("negatives clamp to zero", () => {
    expect(clampDiscount(-50, 200)).toBe(0);
  });
  it("over-subtotal clamps to subtotal", () => {
    expect(clampDiscount(500, 200)).toBe(200);
  });
  it("in-range passes through", () => {
    expect(clampDiscount(25, 200)).toBe(25);
  });
  it("NaN / Infinity clamp to zero", () => {
    // !isFinite() short-circuits both — a malicious client can't slip an
    // Infinity past the gate and wipe the bill.
    expect(clampDiscount(NaN, 200)).toBe(0);
    expect(clampDiscount(Infinity, 200)).toBe(0);
    expect(clampDiscount(-Infinity, 200)).toBe(0);
  });
});

// ─── (A) createPOSSale ────────────────────────────────────────────────────
describe("W3-CRIT-04 (A) pos/actions.ts::createPOSSale — server recomputes money", () => {
  const src = readSrc("app/(app)/pos/actions.ts");

  it("imports getTenantTaxConfig + computeMoneyTotals + clampDiscount", () => {
    expect(src).toMatch(
      /import \{[^}]*getTenantTaxConfig[^}]*computeMoneyTotals[^}]*clampDiscount[^}]*\} from ["']@\/lib\/tenant-tax["']/
    );
  });

  it("fetches tenant tax config before building the sale", () => {
    expect(src).toMatch(/getTenantTaxConfig\(tenantId\)/);
  });

  it("recomputes totals from the cart via computeMoneyTotals", () => {
    expect(src).toMatch(/computeMoneyTotals\(/);
    // cart items are mapped to {quantity, unit_price} shape somewhere
    // in the file. Use flat single-line regex (source has newlines so
    // check both halves independently).
    expect(src).toMatch(/params\.cart\.map/);
    expect(src).toMatch(/quantity:\s*c\.quantity/);
    expect(src).toMatch(/unit_price:\s*c\.unitPrice/);
  });

  it("clamps the staff-entered discount with clampDiscount", () => {
    expect(src).toMatch(/clampDiscount\(\s*params\.discountAmount/);
  });

  it("rejects with a Client-total-mismatch error when params.total diverges >1c", () => {
    expect(src).toMatch(/Math\.abs\(serverTotals\.total - params\.total\)\s*>\s*0\.01/);
    expect(src).toMatch(/Client total mismatch/);
  });

  it("the sales insert stores server-recomputed money, NEVER params.subtotal/.total/.taxAmount/.discountAmount", () => {
    // Four critical money fields must be the server-recomputed values.
    // Grep file-wide — the only `.from("sales").insert(...)` in
    // createPOSSale is inside the create_sale step; the createLaybySale
    // insert uses `laybyServerTotals.*` so these patterns don't collide.
    expect(src).toMatch(/subtotal:\s*serverTotals\.subtotal/);
    expect(src).toMatch(/discount_amount:\s*serverDiscount\b/);
    expect(src).toMatch(/tax_amount:\s*serverTotals\.taxAmount/);
    expect(src).toMatch(/total:\s*serverTotals\.total/);
    // And the old bug patterns must be gone file-wide (both POS + layby)
    expect(src).not.toMatch(/subtotal:\s*params\.subtotal\b/);
    expect(src).not.toMatch(/total:\s*params\.total\b/);
    expect(src).not.toMatch(/tax_amount:\s*params\.taxAmount\b/);
    expect(src).not.toMatch(/discount_amount:\s*params\.discountAmount\b/);
  });

  it("the sale_items insert uses server-authoritative line_totals", () => {
    expect(src).toMatch(/line_total:\s*serverTotals\.lineTotals\[idx\]/);
    // The old bug pattern (line_total = item.unitPrice * item.quantity) is gone
    // from the sale_items insert. It's fine if it appears in a comment,
    // but not as an active assignment.
    const saleItemsBlock = src.match(
      /\.from\(["']sale_items["']\)\s*\.insert\([\s\S]*?\)\s*;/
    );
    expect(saleItemsBlock, "sale_items insert not found").toBeTruthy();
    expect(saleItemsBlock![0]).not.toMatch(
      /line_total:\s*item\.unitPrice\s*\*\s*item\.quantity/
    );
  });

  it("the invoice insert in Step 6 uses server-recomputed money + tenant tax config", () => {
    // basePayload is the only invoices-insert payload in createPOSSale.
    // Assert the four money fields + tenant-derived tax config are
    // present, and the client-supplied tax params are gone.
    expect(src).toMatch(/tax_rate:\s*taxCfg\.tax_rate/);
    expect(src).toMatch(/tax_name:\s*taxCfg\.tax_name/);
    expect(src).not.toMatch(/tax_name:\s*params\.taxName/);
    expect(src).not.toMatch(/tax_rate:\s*params\.taxRate/);
    expect(src).not.toMatch(/amount_paid:\s*params\.total\b/);
  });
});

// ─── (B) createLaybySale ──────────────────────────────────────────────────
describe("W3-CRIT-04 (B) pos/actions.ts::createLaybySale — server recomputes money", () => {
  const src = readSrc("app/(app)/pos/actions.ts");

  it("createLaybySale recomputes totals via computeMoneyTotals", () => {
    // Isolate the createLaybySale function body.
    const fnMatch = src.match(/export async function createLaybySale[\s\S]*?(?=\n\/\/ ─|\n?export async function|$)/);
    expect(fnMatch, "createLaybySale not found").toBeTruthy();
    const body = fnMatch![0];
    expect(body).toMatch(/getTenantTaxConfig\(tenantId\)/);
    expect(body).toMatch(/computeMoneyTotals\(/);
    expect(body).toMatch(/clampDiscount\(\s*params\.discountAmount/);
    expect(body).toMatch(/laybyServerTotals/);
  });

  it("createLaybySale rejects on client total mismatch", () => {
    const fnMatch = src.match(/export async function createLaybySale[\s\S]*?(?=\n\/\/ ─|\n?export async function|$)/);
    const body = fnMatch![0];
    expect(body).toMatch(/Math\.abs\(laybyServerTotals\.total - params\.total\)\s*>\s*0\.01/);
    expect(body).toMatch(/Client total mismatch/);
  });

  it("createLaybySale sales insert uses server-recomputed money (no params.total / params.subtotal / params.taxAmount)", () => {
    const fnMatch = src.match(/export async function createLaybySale[\s\S]*?(?=\n\/\/ ─|\n?export async function|$)/);
    const body = fnMatch![0];
    const insertBlock = body.match(/\.from\(["']sales["']\)\s*\.insert\(\{[\s\S]*?\}\)/);
    expect(insertBlock, "layby sales insert not found").toBeTruthy();
    const ins = insertBlock![0];
    expect(ins).toMatch(/subtotal:\s*laybyServerTotals\.subtotal/);
    expect(ins).toMatch(/total:\s*laybyServerTotals\.total/);
    expect(ins).toMatch(/tax_amount:\s*laybyServerTotals\.taxAmount/);
    expect(ins).toMatch(/discount_amount:\s*laybyServerDiscount/);
    expect(ins).not.toMatch(/subtotal:\s*params\.subtotal/);
    expect(ins).not.toMatch(/total:\s*params\.total/);
    expect(ins).not.toMatch(/tax_amount:\s*params\.taxAmount/);
  });

  it("createLaybySale sale_items insert uses server-authoritative line_totals", () => {
    const fnMatch = src.match(/export async function createLaybySale[\s\S]*?(?=\n\/\/ ─|\n?export async function|$)/);
    const body = fnMatch![0];
    const itemsBlock = body.match(/\.from\(["']sale_items["']\)\s*\.insert\([\s\S]*?\)\s*;/);
    expect(itemsBlock, "layby sale_items insert not found").toBeTruthy();
    expect(itemsBlock![0]).toMatch(/line_total:\s*laybyServerTotals\.lineTotals\[idx\]/);
    expect(itemsBlock![0]).not.toMatch(/line_total:\s*item\.unitPrice\s*\*\s*item\.quantity/);
  });
});

// ─── (C) createSale in sales/actions.ts ───────────────────────────────────
describe("W3-CRIT-04 (C) sales/actions.ts::createSale — recomputes line_total + subtotal", () => {
  const src = readSrc("app/(app)/sales/actions.ts");

  it("no longer sums client-supplied item.line_total for the subtotal", () => {
    // The canonical bug pattern was:
    //   const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    // Lock the fix in place — the reduce must reference quantity & unit_price
    // (and discount_pct), never item.line_total.
    expect(src).not.toMatch(/reduce\(\s*\(sum,\s*item\)\s*=>\s*sum\s*\+\s*item\.line_total/);
  });

  it("computes serverLineTotals from quantity * unit_price * (1 - discount_pct/100)", () => {
    expect(src).toMatch(/serverLineTotals/);
    expect(src).toMatch(/item\.quantity\s*\*\s*item\.unit_price\s*\*\s*\(1\s*-\s*disc\)/);
  });

  it("clamps staff-entered discount_amount and discount_pct", () => {
    expect(src).toMatch(/Math\.min\(Math\.max\(discountAmountRaw,\s*0\),\s*subtotal\)/);
    expect(src).toMatch(/Math\.min\(Math\.max\(item\.discount_pct\s*\?\?\s*0,\s*0\),\s*100\)/);
  });

  it("sale_items insert uses serverLineTotals[idx], not item.line_total", () => {
    const match = src.match(/\.from\(["']sale_items["']\)\s*\.insert\(saleItemsData\)/);
    expect(match, "sale_items insert missing").toBeTruthy();
    // saleItemsData mapping must use serverLineTotals
    expect(src).toMatch(/line_total:\s*serverLineTotals\[idx\]/);
    // and must NOT use item.line_total as a line_total source anymore
    const mapBlock = src.match(/const saleItemsData\s*=\s*lineItems\.map\([\s\S]*?\)\s*\)\s*;/);
    expect(mapBlock, "saleItemsData mapping not found").toBeTruthy();
    expect(mapBlock![0]).not.toMatch(/line_total:\s*item\.line_total/);
  });
});

// ─── (D) quotes/actions-server.ts ─────────────────────────────────────────
describe("W3-CRIT-04 (D) quotes/actions-server.ts::createQuote — recomputes total_amount", () => {
  const src = readSrc("app/(app)/quotes/actions-server.ts");

  it("imports getTenantTaxConfig + computeMoneyTotals", () => {
    expect(src).toMatch(
      /import \{[^}]*getTenantTaxConfig[^}]*computeMoneyTotals[^}]*\} from ["']@\/lib\/tenant-tax["']/
    );
  });

  it("createQuote insert stores server-recomputed total, not input.total_amount", () => {
    const fnMatch = src.match(/export async function createQuote[\s\S]*?(?=\n?export async function|$)/);
    expect(fnMatch).toBeTruthy();
    const body = fnMatch![0];
    // The fix defines serverQuoteTotal and uses it in the insert.
    expect(body).toMatch(/serverQuoteTotal/);
    expect(body).toMatch(/total_amount:\s*serverQuoteTotal/);
    expect(body).not.toMatch(/total_amount:\s*input\.total_amount/);
    // Recompute sum expression is present
    expect(body).toMatch(/it\.quantity\s*\*\s*it\.unit_price/);
  });
});

describe("W3-CRIT-04 (D) quotes/actions-server.ts::convertQuoteToInvoice — applies tenant tax config", () => {
  const src = readSrc("app/(app)/quotes/actions-server.ts");

  it("calls getTenantTaxConfig + computeMoneyTotals when building invoiceData", () => {
    const fnMatch = src.match(/export async function convertQuoteToInvoice[\s\S]*?(?=\n?export async function|$)/);
    expect(fnMatch).toBeTruthy();
    const body = fnMatch![0];
    expect(body).toMatch(/getTenantTaxConfig\(tenantId\)/);
    expect(body).toMatch(/computeMoneyTotals\(/);
  });

  it("invoiceData carries subtotal / tax_amount / tax_rate / tax_name / tax_inclusive / total — not subtotal=total_amount", () => {
    const fnMatch = src.match(/export async function convertQuoteToInvoice[\s\S]*?(?=\n?export async function|$)/);
    const body = fnMatch![0];
    const invBlock = body.match(/const invoiceData\s*=\s*\{[\s\S]*?\};/);
    expect(invBlock, "invoiceData block not found").toBeTruthy();
    const block = invBlock![0];
    expect(block).toMatch(/subtotal:\s*convertTotals\.subtotal/);
    expect(block).toMatch(/tax_amount:\s*convertTotals\.taxAmount/);
    expect(block).toMatch(/total:\s*convertTotals\.total/);
    expect(block).toMatch(/tax_rate:\s*convertTaxCfg\.tax_rate/);
    expect(block).toMatch(/tax_name:\s*convertTaxCfg\.tax_name/);
    expect(block).toMatch(/tax_inclusive:\s*convertTaxCfg\.tax_inclusive/);
    // The bug pattern was both subtotal and total = quote.total_amount.
    // That assignment is gone — lock it.
    expect(block).not.toMatch(/subtotal:\s*quote\.total_amount/);
    expect(block).not.toMatch(/total:\s*quote\.total_amount/);
  });
});

// ─── Preserved guards: verify we did NOT weaken existing permission / idempotency gates ───
describe("W3-CRIT-04 — existing guards remain intact after the money-flow fix", () => {
  it("quotes actions still call requirePermission('create_invoices')", () => {
    const src = readSrc("app/(app)/quotes/actions-server.ts");
    expect(src).toMatch(/requirePermission\(["']create_invoices["']\)/);
  });

  it("sales actions still call requirePermission('create_invoices')", () => {
    const src = readSrc("app/(app)/sales/actions.ts");
    expect(src).toMatch(/requirePermission\(["']create_invoices["']\)/);
  });

  it("POS createPOSSale retains its idempotency-key short-circuit", () => {
    const src = readSrc("app/(app)/pos/actions.ts");
    expect(src).toMatch(/params\.idempotencyKey/);
    expect(src).toMatch(/Duplicate POS submission prevented/);
  });
});
