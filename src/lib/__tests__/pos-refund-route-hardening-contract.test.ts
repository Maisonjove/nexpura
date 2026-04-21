import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression contract for PR-09:
 *   /api/pos/refund is hardened to parity with the processRefund
 *   server action. Asserts the four safety primitives are in place:
 *     - RBAC gate (requirePermission create_invoices) — PR-07
 *     - withIdempotency wrap with a payment fingerprint
 *     - server-side bound check against sale.total − prior refunds
 *     - session-derived tenantId (body tenantId ignored)
 *
 * These are lock-tests — if a future edit drops any of them the
 * build breaks before shipping.
 */

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

describe("PR-09 /api/pos/refund — safety primitives at parity with processRefund", () => {
  const src = readSrc("app/api/pos/refund/route.ts");

  it("imports requirePermission and gates on create_invoices", () => {
    expect(src).toMatch(/requirePermission\(["']create_invoices["']\)/);
  });

  it("imports withIdempotency + createPaymentFingerprint", () => {
    expect(src).toMatch(/import \{[^}]*withIdempotency[^}]*\} from ["']@\/lib\/idempotency["']/);
    expect(src).toMatch(/import \{[^}]*createPaymentFingerprint[^}]*\} from ["']@\/lib\/idempotency["']/);
  });

  it("wraps the refund insert path inside withIdempotency(\"refund\", ...)", () => {
    expect(src).toMatch(/withIdempotency\(\s*["']refund["']/);
  });

  it("computes the refund subtotal from items (server-side) rather than trusting body.total", () => {
    // Canonical: `items2.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0)`
    expect(src).toMatch(/refundSubtotal\s*=\s*items2\.reduce/);
  });

  it("bounds refundSubtotal against (sale.total − alreadyRefunded)", () => {
    expect(src).toMatch(/alreadyRefunded/);
    expect(src).toMatch(/remainingRefundable\s*=\s*saleTotal\s*-\s*alreadyRefunded/);
    expect(src).toMatch(/refundSubtotal\s*>\s*remainingRefundable/);
  });

  it("rejects zero/negative server-computed subtotal", () => {
    expect(src).toMatch(/refundSubtotal\s*<=\s*0/);
  });

  it("uses session-derived tenantId (body tenantId ignored)", () => {
    expect(src).toMatch(/const tenantId = ctx\.tenantId/);
  });

  it("stores the SERVER-computed subtotal in the refunds row, not body.total", () => {
    // The `total:` column on the refunds.insert must be refundSubtotal,
    // not the destructured body `total`. The destructure must not
    // include `total` at all in the fixed version.
    expect(src).toMatch(/total:\s*refundSubtotal/);
    expect(src).not.toMatch(/const\s*\{[^}]*\btotal\b[^}]*\}\s*=\s*parseResult\.data/);
  });

  it("applies store-credit refunds with a compare-and-swap retry", () => {
    // Same pattern as processRefund — prevents a concurrent POS sale
    // from clobbering the credit addition.
    expect(src).toMatch(/\.eq\(["']store_credit["'],\s*oldBalance\)/);
    expect(src).toMatch(/customerRetry/);
  });

  it("returns 409 on idempotency duplicate (so the client can dedupe)", () => {
    expect(src).toMatch(/duplicate[\s\S]{0,120}status:\s*409/);
  });
});
