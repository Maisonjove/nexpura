/**
 * A1 Day 4 — ManagerPinModal contract.
 *
 * Source-text pin on the two-state modal's behaviour. Component-
 * level interaction tests would require the React testing setup
 * which isn't wired in this codebase; the source-grep tests pin
 * the structural invariants — autoFocus, numeric-only input,
 * 4-6 digit format, error surface, the dual cancel/submit
 * actions — so a future refactor can't silently strip them.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "components", "ManagerPinModal.tsx"),
  "utf8",
);

describe("ManagerPinModal — set vs verify mode dispatch", () => {
  it("accepts mode: 'set' | 'verify' prop", () => {
    expect(SRC).toMatch(/mode:\s*["']set["']\s*\|\s*["']verify["']/);
  });

  it("renders the right title for set mode", () => {
    expect(SRC).toMatch(/mode === ["']set["'][\s\S]{0,100}?Set your manager PIN/);
  });

  it("renders the right title for verify mode", () => {
    expect(SRC).toMatch(/Enter your manager PIN/);
  });

  it("only renders the Confirm PIN input in set mode", () => {
    // The confirm input is gated on mode === "set"
    expect(SRC).toMatch(
      /\{mode === ["']set["'] && \([\s\S]{0,800}?manager-pin-confirm-input/,
    );
  });
});

describe("ManagerPinModal — input validation", () => {
  it("strips non-digit characters from the PIN input", () => {
    expect(SRC).toMatch(/replace\(\/\[\^\\d\]\/g,\s*["']["']\)/);
  });

  it("validates PIN format (4-6 digits) before submit", () => {
    expect(SRC).toMatch(/\^\\d\{4,6\}\$/);
    expect(SRC).toMatch(/PIN must be 4.6 digits/);
  });

  it("requires PIN === confirmPin in set mode", () => {
    expect(SRC).toMatch(/pin !== confirmPin[\s\S]{0,80}?PINs don.t match/);
  });
});

describe("ManagerPinModal — submit/verify wiring", () => {
  it("calls onSetPin in set mode + onSubmit on success", () => {
    expect(SRC).toMatch(/onSetPin\(pin\)/);
    expect(SRC).toMatch(/onSubmit\(pin\)/);
  });

  it("calls onVerifyPin in verify mode + checks .valid", () => {
    expect(SRC).toMatch(/onVerifyPin\(pin\)/);
    expect(SRC).toMatch(/!result\.valid[\s\S]{0,100}?PIN incorrect/);
  });

  it("surfaces server errors inline (rate-limit, trivial-PIN block, etc.)", () => {
    // The action returns { error: 'Too many PIN attempts...' } and
    // { error: 'PIN is too easy to guess...' } — the modal renders
    // those verbatim in the alert div.
    expect(SRC).toMatch(/setError\(result\.error\)/);
    expect(SRC).toMatch(/data-testid="manager-pin-error"/);
  });
});

describe("ManagerPinModal — accessibility + cancel", () => {
  it("has role='dialog' + aria-modal", () => {
    expect(SRC).toMatch(/role="dialog"\s+aria-modal="true"/);
  });

  it("autofocuses the PIN input", () => {
    expect(SRC).toMatch(/autoFocus/);
  });

  it("has a Cancel button that calls onCancel", () => {
    expect(SRC).toMatch(/onClick=\{onCancel\}/);
  });

  it("uses inputMode='numeric' for mobile keypad", () => {
    expect(SRC).toMatch(/inputMode="numeric"/);
  });

  it("uses type='password' to mask the PIN", () => {
    expect(SRC).toMatch(/type="password"/);
  });
});
