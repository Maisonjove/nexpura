/**
 * P0 guard contract — fake-refund prevention.
 *
 * Audit C-01 (2026-05-06): updateSaleStatus accepted any status string
 * and SaleDetailClient.tsx exposed a dropdown that included 'refunded'
 * as a selectable value. Anyone with `create_invoices` permission could
 * fake-refund any sale by clicking the dropdown — no refund row, no
 * money moved, no GL, no audit. Caught in prod on hello@nexpura sale
 * b5b60d1a ($2,750, 2026-05-05).
 *
 * Two layers, both pinned here:
 *   1. UI: SaleDetailClient.tsx STATUSES does NOT include 'refunded'.
 *   2. Server: updateSaleStatus rejects 'refunded' unless a
 *      refunds row already exists for the sale.
 *
 * Cross-reference: src/app/(app)/refunds/actions.ts:336 — the canonical
 * processRefund flips the parent sale to 'refunded' as the LAST step,
 * and only when fully refunded. So the only legitimate state in which
 * the parent's status is 'refunded' is one where a refunds row exists.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf8");
}

describe("P0 fake-refund guard — UI layer (SaleDetailClient.tsx)", () => {
  const ui = readSrc("app/(app)/sales/[id]/SaleDetailClient.tsx");

  it("STATUSES dropdown does NOT include 'refunded'", () => {
    // Specifically the STATUSES const used by the dropdown.
    const match = ui.match(/const\s+STATUSES\s*=\s*\[([^\]]*)\]/);
    expect(match, "STATUSES const must be present").toBeTruthy();
    const arr = match![1];
    expect(arr).not.toMatch(/['"]refunded['"]/);
  });

  it("STATUSES still contains the canonical legitimate flips", () => {
    // Regression guard for accidental over-pruning. The legitimate
    // states a user can manually flip TO are still allowed.
    const match = ui.match(/const\s+STATUSES\s*=\s*\[([^\]]*)\]/);
    const arr = match![1];
    for (const s of ["quote", "confirmed", "paid", "completed", "layby"]) {
      expect(arr, `STATUSES should include "${s}"`).toMatch(
        new RegExp(`['"]${s}['"]`),
      );
    }
  });

  it("STATUS_COLOURS still maps 'refunded' (badge can still display refunded sales)", () => {
    // The colour map is for rendering badges on refunded sales the
    // legitimate refund flow created. We're not hiding the visual
    // representation — just removing it from the user-selectable set.
    expect(ui).toMatch(/refunded:\s*["']bg-red/);
  });
});

describe("P0 fake-refund guard — server layer (updateSaleStatus)", () => {
  const src = readSrc("app/(app)/sales/actions.ts");

  it("updateSaleStatus has an early-return guard on status === 'refunded'", () => {
    // The guard reads a refunds row first and bails if none exists.
    // Pin the structural shape so a future refactor can't silently
    // drop it.
    const fnBody = src.split(/export\s+async\s+function\s+updateSaleStatus/)[1] ?? "";
    expect(fnBody).toMatch(/status\s*===\s*["']refunded["']/);
    expect(fnBody).toMatch(
      /\.from\(\s*["']refunds["']\s*\)[\s\S]{0,200}?\.eq\(\s*["']original_sale_id["']/,
    );
    // Bail-out: returns an error result when no refund row exists.
    expect(fnBody).toMatch(/Cannot mark sale as refunded directly|return\s*\{\s*error/);
  });

  it("the guard fires BEFORE the .update() call (defense at the right layer)", () => {
    const fnBody = src.split(/export\s+async\s+function\s+updateSaleStatus/)[1] ?? "";
    const guardPos = fnBody.search(/status\s*===\s*["']refunded["']/);
    const updatePos = fnBody.search(/\.from\(\s*["']sales["']\s*\)\s*\n?\s*\.update/);
    expect(guardPos).toBeGreaterThanOrEqual(0);
    expect(updatePos).toBeGreaterThan(guardPos);
  });

  it("non-refunded statuses are unaffected by the guard (no false-positive lockout)", () => {
    // The guard's `if (status === "refunded")` block is the ONLY
    // branch that touches the refunds table. Pin that we don't have
    // a global "always check refunds" pattern that could break
    // legitimate quote/paid/completed flips.
    const fnBody = src.split(/export\s+async\s+function\s+updateSaleStatus/)[1] ?? "";
    // The guard is conditional on `status === "refunded"`.
    expect(fnBody).toMatch(/if\s*\(\s*status\s*===\s*["']refunded["']\s*\)\s*\{/);
  });
});

describe("P0 fake-refund guard — refund flow still flips status correctly", () => {
  // Sanity check that the legitimate path (processRefund in
  // refunds/actions.ts) still flips the parent sale to 'refunded' on
  // full-refund — the guard above must NOT block this path.
  const refundActions = readSrc("app/(app)/refunds/actions.ts");

  it("processRefund still updates sales.status='refunded' on fully-refunded path", () => {
    expect(refundActions).toMatch(
      /\.from\(\s*["']sales["']\s*\)\s*\n?\s*\.update\(\{\s*status:\s*["']refunded["']/,
    );
  });

  it("processRefund's flip is gated on fullyRefunded predicate (NOT on every partial)", () => {
    // The flip-on-partial bug was fixed earlier; re-pin here so the
    // P0 guard's "refund row must exist" requirement holds correctly.
    expect(refundActions).toMatch(/fullyRefunded\s*=/);
  });
});
