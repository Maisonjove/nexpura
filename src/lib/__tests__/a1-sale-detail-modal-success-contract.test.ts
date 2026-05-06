/**
 * A1 Round 4 — SaleDetailClient v2-RPC success-branch contract.
 *
 * Cross-references:
 *   - PR #200 merge commit `ebcdb6a4` (A1 money-correctness merge that
 *     swapped processRefund's contract from a redirect()-on-success
 *     server action to a v2 RPC returning `{ id, refundNumber }`).
 *   - QA Round 4 finding "Critical 1 — React #419 modal storm". Active
 *     prod regression: the refund modal in SaleDetailClient.tsx never
 *     closed on success because the client logic was still written for
 *     the legacy redirect contract. Cashier saw no feedback, clicked
 *     again, audit_log fired per click (server-side idempotency dedupe
 *     prevented duplicate refund rows but UX was broken), 13 React
 *     error #419 instances captured in Desktop-Opus's session.
 *
 * Invariant pinned by this file:
 *   Any v2-RPC server-action returning `{ id }` MUST be paired with
 *   client-side state cleanup on success — close any modal it lives
 *   in, clear the form fields, refresh + navigate. The next refactor
 *   that deletes the success branch trips this test.
 *
 * Style note: source-grep contract (consistent with neighbouring A1
 * contract tests, e.g. a1-sale-detail-pin-integration.test.ts and the
 * forgot-password-contract pattern). Sufficient to keep the
 * client-side state plumbing pinned without standing up a full DOM
 * harness; lint rules for client-side state plumbing are out of scope
 * (see §15 — mocking the contract point).
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
    "sales",
    "[id]",
    "SaleDetailClient.tsx",
  ),
  "utf8",
);

describe("SaleDetailClient — v2 refund success branch (Round 4 C1)", () => {
  it("attemptRefund branches on result?.id and closes the refund modal in the same branch", () => {
    // The success branch must reference result?.id AND call
    // setShowRefundModal(false) within the same logical block.
    expect(SRC).toMatch(
      /attemptRefund[\s\S]{0,800}?result\?\.id[\s\S]{0,400}?setShowRefundModal\(false\)/,
    );
  });

  it("success branch clears refund form state", () => {
    expect(SRC).toMatch(
      /result\?\.id[\s\S]{0,800}?setRefundItems\(\{\}\)/,
    );
    expect(SRC).toMatch(
      /result\?\.id[\s\S]{0,800}?setRefundReason\(["']{2}\)/,
    );
    expect(SRC).toMatch(
      /result\?\.id[\s\S]{0,800}?setRefundMethod\(["']card["']\)/,
    );
    expect(SRC).toMatch(
      /result\?\.id[\s\S]{0,800}?setRefundNotes\(["']{2}\)/,
    );
  });

  it("success branch calls router.refresh() and router.push to the new refund", () => {
    expect(SRC).toMatch(/result\?\.id[\s\S]{0,800}?router\.refresh\(\)/);
    expect(SRC).toMatch(
      /result\?\.id[\s\S]{0,800}?router\.push\(`\/refunds\/\$\{result\.id\}`\)/,
    );
  });

  it("preserves the existing error branch (setRefundError still called for non-PIN errors)", () => {
    expect(SRC).toMatch(/setRefundError\(result\.error\)/);
  });

  it("preserves the PIN-required dispatch (modal opens for PIN-required errors)", () => {
    // Defence in depth: the success branch addition mustn't break the
    // PIN dispatch path that a1-sale-detail-pin-integration also pins.
    expect(SRC).toMatch(/MANAGER_PIN_REQUIRED_PREFIX/);
    expect(SRC).toMatch(/MANAGER_PIN_WINDOW_PREFIX/);
    expect(SRC).toMatch(/setShowPinModal\(true\)/);
  });

  it('"Process Refund" submit button is disabled while isPending', () => {
    // Defence in depth against the click-storm that triggered #419 in
    // Round 4. The button text is "Process Refund" (or "Processing…"
    // when pending); disabled must be wired to isPending from the
    // outer useTransition.
    expect(SRC).toMatch(
      /onClick=\{handleProcessRefund\}[\s\S]{0,200}?disabled=\{isPending\}/,
    );
  });

  it("isPending comes from the component's useTransition hook (not a local variable)", () => {
    expect(SRC).toMatch(/const\s*\[\s*isPending\s*,\s*startTransition\s*\]\s*=\s*useTransition\(\)/);
  });
});
