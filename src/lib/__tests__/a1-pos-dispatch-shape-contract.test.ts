/**
 * A1 Day 2 — /api/pos/refund dispatch contract.
 *
 * Sibling pin to a1-dispatch-shape-contract.test.ts. The POS path
 * and the refunds page action both flag-gate on the same column
 * and call the same RPC; this test guards against drift between
 * the two paths over time.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "app", "api", "pos", "refund", "route.ts"),
  "utf8",
);

describe("A1 POS dispatch — feature flag gate at top of POST", () => {
  it("reads tenants.a1_money_correctness BEFORE the legacy bound check", () => {
    const flagPos = SRC.search(/a1_money_correctness/);
    const boundPos = SRC.search(/refundTotal > remainingRefundable/);
    expect(flagPos).toBeGreaterThan(0);
    expect(boundPos).toBeGreaterThan(flagPos);
  });

  it("dispatches to dispatchPosRefundV2 when flag is TRUE", () => {
    expect(SRC).toMatch(
      /a1_money_correctness === true[\s\S]{0,200}?return\s+await\s+dispatchPosRefundV2/,
    );
  });
});

describe("A1 POS dispatch — sibling parity with processRefundV2", () => {
  it("uses the same 30-day PIN window constant value (not name)", () => {
    expect(SRC).toMatch(
      /POS_REFUND_PIN_WINDOW_MS\s*=\s*30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    );
  });

  it("PIN-required branch fires when sale older than the window", () => {
    expect(SRC).toMatch(/saleAgeMs\s*>\s*POS_REFUND_PIN_WINDOW_MS/);
  });

  it("verifies the calling user's own PIN via verifyManagerPin", () => {
    expect(SRC).toMatch(/verifyManagerPin\(p\.managerPin/);
  });

  it("returns 403 on missing PIN, 403 on wrong PIN, 403 on no PIN configured", () => {
    // Pin the status code consistency. PIN failures are RBAC failures
    // and should always be 403, never 400/401.
    const pinErrorBlocks = SRC.match(/(?:[Mm]anager PIN|PIN is required)[\s\S]{0,200}?status:\s*403/g);
    expect(pinErrorBlocks?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe("A1 POS dispatch — RPC call shape (matches refunds page)", () => {
  it("calls process_refund_v2 with the same 10 named parameters", () => {
    const callBlock = SRC.match(
      /admin\.rpc\(\s*["']process_refund_v2["'][\s\S]+?\)\s*;/,
    )?.[0] ?? "";
    expect(callBlock, "rpc call must be present").not.toBe("");
    for (const p of [
      "p_tenant_id",
      "p_user_id",
      "p_original_sale_id",
      "p_reason",
      "p_refund_method",
      "p_refund_type",
      "p_items",
      "p_notes",
      "p_gateway_ref",
      "p_idempotency_key",
    ]) {
      expect(callBlock, `RPC call must pass ${p}`).toContain(p);
    }
  });

  it("idempotency_key fingerprint matches the legacy POS shape (saleId:method:items)", () => {
    expect(SRC).toMatch(
      /\$\{p\.saleId\}:\$\{p\.refundMethod\}:\$\{itemFingerprint\}/,
    );
  });

  it("maps PostgreSQL error codes to HTTP statuses (23514 → 400, P0002 → 404)", () => {
    expect(SRC).toMatch(/error\.code === "23514"[\s\S]{0,200}?status:\s*400/);
    expect(SRC).toMatch(/error\.code === "P0002"[\s\S]{0,200}?status:\s*404/);
  });

  it("response body carries flowVersion='v2' on success", () => {
    expect(SRC).toMatch(/flowVersion:\s*["']v2["']/);
  });

  it("re-maps POS items (saleItemId) → RPC shape (original_sale_item_id)", () => {
    expect(SRC).toMatch(
      /original_sale_item_id:\s*i\.saleItemId/,
    );
  });
});
