/**
 * C1 contract — POS saga ordering: deduct_stock MUST precede sale insert.
 *
 * Audit C1 (Desktop-Opus QA Round 2, 2026-05-06): the createPOSSale saga
 * in src/app/(app)/pos/actions.ts inserted the sales row (status='paid')
 * BEFORE running pos_deduct_stock. When a concurrent terminal had already
 * decremented inventory to 0 the RPC raised insufficient_stock, the
 * cashier got the red "Sale couldn't be completed" banner — but the sales
 * row had already been committed. Compensation flips it to 'voided',
 * which closes most of the window, but ANY compensate-failure (logged
 * but swallowed) leaves a phantom paid sale with no money received.
 * Same blast-radius family as PR #199's C-01 fake-refund guard.
 *
 * Fix shape F1.B (Joey-approved): reorder the saga so deduct_stock is
 * step 1 of executeWithSafety. Insufficient_stock now fails BEFORE any
 * sale row exists, eliminating the phantom-paid window entirely.
 *
 * This is a structural lock-test on the source. We assert that the
 * deduct_stock step appears BEFORE the create_sale step in the saga
 * array, and that the canonical RPC call (`admin.rpc("pos_deduct_stock"`)
 * appears BEFORE the sales-table insert (`from("sales").insert(`).
 *
 * Cross-references:
 *   - PR #199 commit c24628ff (C-01 fake-refund guard) — half-fix-pair §13
 *   - supabase/migrations/20260424_pos_deduct_stock_rpc.sql — RPC contract
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf8");
}

describe("C1 POS saga ordering — deduct_stock precedes sale insert", () => {
  const src = readSrc("app/(app)/pos/actions.ts");

  // Locate the createPOSSale function body. Layby has its own flow we
  // explicitly do NOT touch in this fix; scoping to createPOSSale
  // protects the test from accidentally matching layby content.
  const createSaleStart = src.indexOf("export async function createPOSSale");
  const laybyStart = src.indexOf("export async function createLaybySale");
  expect(createSaleStart, "createPOSSale must exist").toBeGreaterThan(-1);
  expect(laybyStart, "createLaybySale must exist (scope boundary)").toBeGreaterThan(
    createSaleStart,
  );
  const fnBody = src.slice(createSaleStart, laybyStart);

  it("the deduct_stock step appears BEFORE the create_sale step in the saga array", () => {
    const deductIdx = fnBody.indexOf('name: "deduct_stock"');
    const createSaleIdx = fnBody.indexOf('name: "create_sale"');
    expect(deductIdx, 'step name: "deduct_stock" must be present').toBeGreaterThan(-1);
    expect(createSaleIdx, 'step name: "create_sale" must be present').toBeGreaterThan(-1);
    expect(
      deductIdx,
      'C1 invariant: deduct_stock must come BEFORE create_sale so insufficient_stock cannot leave a phantom paid sale',
    ).toBeLessThan(createSaleIdx);
  });

  it("the pos_deduct_stock RPC call appears BEFORE the sales-table insert", () => {
    // Lower-level invariant: even if someone renames a step, the
    // canonical effectful operations must still be in the right order.
    const rpcIdx = fnBody.indexOf('admin.rpc("pos_deduct_stock"');
    // Match the canonical saga write: `.from("sales")` immediately
    // followed by `.insert(` (with whitespace tolerance). The
    // idempotency-check uses `.select(`, so it won't false-match.
    const insertMatch = fnBody.match(/\.from\("sales"\)\s*\.insert\(/);
    const insertIdx = insertMatch ? fnBody.indexOf(insertMatch[0]) : -1;
    expect(rpcIdx, "pos_deduct_stock RPC call must be present").toBeGreaterThan(-1);
    expect(insertIdx, "sales insert must be present").toBeGreaterThan(-1);
    expect(
      rpcIdx,
      "C1 invariant: pos_deduct_stock RPC must run BEFORE the sales row is inserted",
    ).toBeLessThan(insertIdx);
  });

  it("the deduct_stock step still has a compensate fn (post-reorder rollback path)", () => {
    // After reorder, deduct_stock is step 1. If a LATER step fails
    // (create_sale, create_sale_items, etc.), executeWithSafety walks
    // completedSteps in reverse and runs each compensate. The stock
    // restore must still be reachable.
    const deductIdx = fnBody.indexOf('name: "deduct_stock"');
    // Look ahead a generous window for the compensate hook on the
    // same step object.
    const window = fnBody.slice(deductIdx, deductIdx + 6000);
    expect(window).toMatch(/compensate:\s*async\s*\(\s*\)\s*=>/);
    expect(window).toMatch(/inventory[\s\S]{0,200}\.update\(\{\s*quantity:/);
  });

  it("does NOT introduce a duplicate deduct_stock step (single source of truth)", () => {
    // Sanity check on the refactor: there should be exactly ONE
    // deduct_stock entry in the saga, not two.
    const matches = fnBody.match(/name:\s*"deduct_stock"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("the saga still runs through executeWithSafety (compensation path intact)", () => {
    expect(fnBody).toMatch(/executeWithSafety\(/);
  });
});
