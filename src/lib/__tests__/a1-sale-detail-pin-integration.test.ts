/**
 * A1 Day 4 — SaleDetailClient ↔ ManagerPinModal integration contract.
 *
 * Source-grep contract that pins the wiring between the sale-detail
 * refund flow and the PIN modal. The actual interaction (click
 * Refund → 403 → modal opens → PIN submit → retry) needs end-to-end
 * tests; here we just pin the structural invariants so a refactor
 * can't silently break the dispatch.
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

describe("SaleDetailClient — PIN modal wiring", () => {
  it("imports ManagerPinModal", () => {
    expect(SRC).toMatch(
      /import\s+ManagerPinModal\s+from\s+["']@\/components\/ManagerPinModal["']/,
    );
  });

  it("imports the three manager-pin server actions", () => {
    expect(SRC).toMatch(/setManagerPin/);
    expect(SRC).toMatch(/verifyManagerPin/);
    expect(SRC).toMatch(/hasManagerPin/);
  });

  it("matches both server-side PIN-required error prefixes", () => {
    expect(SRC).toMatch(/MANAGER_PIN_REQUIRED_PREFIX[\s\S]{0,80}?Manager PIN required/);
    expect(SRC).toMatch(/MANAGER_PIN_WINDOW_PREFIX[\s\S]{0,80}?This sale is older than 30 days/);
  });

  it("passes managerPin into processRefund on retry", () => {
    expect(SRC).toMatch(/managerPin/);
    expect(SRC).toMatch(/processRefund\(buildRefundParams\(managerPin\)\)/);
  });

  it("calls hasManagerPin to decide modal mode after PIN-required error", () => {
    expect(SRC).toMatch(/hasManagerPin\(\)[\s\S]{0,200}?setPinModalMode/);
    expect(SRC).toMatch(/status\.hasPin\s*\?\s*["']verify["']\s*:\s*["']set["']/);
  });

  it("renders ManagerPinModal with set/verify mode dispatch", () => {
    expect(SRC).toMatch(/<ManagerPinModal[\s\S]{0,300}?mode=\{pinModalMode\}/);
    expect(SRC).toMatch(/onSetPin=\{setManagerPin\}/);
    expect(SRC).toMatch(/onVerifyPin=\{verifyManagerPin\}/);
    expect(SRC).toMatch(/onSubmit=\{handlePinSubmit\}/);
    expect(SRC).toMatch(/onCancel=\{handlePinCancel\}/);
  });

  it("modal cancel surfaces a refund-aborted hint to the user", () => {
    expect(SRC).toMatch(
      /handlePinCancel[\s\S]{0,400}?setRefundError[\s\S]{0,80}?manager PIN is required/,
    );
  });
});
