/**
 * A1 Day 2 — processRefund dispatch contract.
 *
 * Pins the source-text shape of the dispatch logic in
 * src/app/(app)/refunds/actions.ts so a future refactor can't
 * silently drop the feature-flag check, the PIN gate, or the v2
 * RPC call site.
 *
 * Behavioural test in Day 5 deploy soak: enable a1_money_correctness
 * for hello@nexpura, run a refund flow end-to-end, verify the
 * gl_entries row + refund row + parent sale.status flip all land in
 * a single transaction.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "app",
    "(app)",
    "refunds",
    "actions.ts",
  ),
  "utf8",
);

describe("A1 dispatch — feature flag check at top of processRefund", () => {
  it("reads tenants.a1_money_correctness BEFORE entering withIdempotency", () => {
    // Pin the position: the flag check fires BEFORE the legacy
    // saga's idempotency wrap so flag-on tenants never hit the
    // legacy fingerprint computation.
    const fnBody = SRC.split(/export async function processRefund\(/)[1] ?? "";
    const flagPos = fnBody.search(/a1_money_correctness/);
    const idempotencyPos = fnBody.search(/withIdempotency\(/);
    expect(flagPos).toBeGreaterThan(0);
    expect(idempotencyPos).toBeGreaterThan(0);
    expect(flagPos).toBeLessThan(idempotencyPos);
  });

  it("dispatches to processRefundV2 when flag is TRUE", () => {
    const fnBody = SRC.split(/export async function processRefund\(/)[1] ?? "";
    expect(fnBody).toMatch(
      /a1_money_correctness === true[\s\S]{0,200}?return processRefundV2/,
    );
  });
});

describe("A1 dispatch — processRefundV2 PIN gate", () => {
  it("enforces a 30-day window via REFUND_PIN_WINDOW_MS constant", () => {
    expect(SRC).toMatch(
      /const\s+REFUND_PIN_WINDOW_MS\s*=\s*30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    );
  });

  it("PIN-required branch fires when sale older than the window", () => {
    expect(SRC).toMatch(/saleAgeMs\s*>\s*REFUND_PIN_WINDOW_MS/);
  });

  it("verifies the calling user's own PIN via verifyManagerPin from @/lib/manager-pin", () => {
    expect(SRC).toMatch(
      /import\(\s*["']@\/lib\/manager-pin["']\s*\)|from\s+["']@\/lib\/manager-pin["']/,
    );
    expect(SRC).toMatch(/verifyManagerPin\(p\.managerPin/);
  });

  it("rejects the refund when no PIN supplied on a beyond-window sale", () => {
    expect(SRC).toMatch(/A manager PIN is required to refund it/);
  });

  it("rejects the refund when PIN is supplied but no PIN hash exists for the user", () => {
    expect(SRC).toMatch(
      /Manager PIN required, but you haven't set one yet/,
    );
  });
});

describe("A1 dispatch — RPC call shape", () => {
  it("calls process_refund_v2 with the canonical 10 named parameters", () => {
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

  it("maps PostgreSQL error codes to user-facing strings", () => {
    // 23514 = check_violation (bound check) → "exceeds remaining"
    // P0002 = no_data_found (sale lookup) → "Original sale not found"
    expect(SRC).toMatch(/error\.code === "23514"[\s\S]{0,200}?exceeds remaining/);
    expect(SRC).toMatch(/error\.code === "P0002"[\s\S]{0,200}?Original sale not found/);
  });

  it("audit-logs the v2 refund with flowVersion='v2' (distinct from legacy path)", () => {
    expect(SRC).toMatch(/flowVersion:\s*["']v2["']/);
  });

  it("idempotency_key fingerprint matches the legacy path shape", () => {
    // Pre-fix flag-flip mid-flow could create a duplicate refund
    // (legacy-path key vs RPC key). The two paths share the same
    // fingerprint shape so flag-flip is safe.
    expect(SRC).toMatch(
      /\$\{p\.originalSaleId\}:\$\{p\.refundMethod\}:\$\{itemFingerprint\}/,
    );
  });
});

describe("A1 dispatch — refund_type defaulting", () => {
  it("defaults to 'store_credit' when refund_method is store_credit, else 'full'", () => {
    expect(SRC).toMatch(
      /refundType[\s\S]{0,80}?p\.refundMethod === ["']store_credit["'][\s\S]{0,40}?["']store_credit["'][\s\S]{0,80}?["']full["']/,
    );
  });
});
