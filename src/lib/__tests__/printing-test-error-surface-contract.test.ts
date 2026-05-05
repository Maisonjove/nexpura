import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-11 printing test-print error surfacing.
 *
 * Audit: "Printing settings has no test print → Send a sample to
 * selected printer." Investigation found the test-print buttons
 * already exist (3 of them — receipt / label / office) and call
 * window.print() on a sample document. The actual gap was that
 * popup-blocker failures were silently swallowed (`if (!w) return`)
 * — user clicked Test Print, nothing happened, no signal.
 *
 * Post-fix mirrors the L-06 pattern: surface the actual failure
 * mode (popup blocked) so the user knows to allow popups for the
 * site instead of debugging printer config.
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/settings/printing/PrintingSettingsClient.tsx"),
  "utf8",
);

describe("PrintingSettingsClient — M-11 test-print error surface", () => {
  it("declares testError state", () => {
    expect(file).toMatch(/setTestError/);
  });

  it("clears testError at the start of testPrint", () => {
    expect(file).toMatch(/function\s+testPrint[\s\S]{0,80}setTestError\(null\)/);
  });

  it("surfaces a popup-blocker error instead of silently returning", () => {
    // Pre-fix `if (!w) return;` is forbidden — must set the error
    // state with a popup-blocker hint.
    expect(file).not.toMatch(/if\s*\(\s*!w\s*\)\s*return\s*;[\s\S]{0,40}\}/);
    expect(file).toMatch(/blocking popups/);
  });

  it("uses w.onload (not a fixed setTimeout) to trigger w.print()", () => {
    // The prior `setTimeout(() => w.print(), 300)` raced with slow
    // page loads. onload fires reliably once the document is ready.
    expect(file).toMatch(/w\.onload\s*=\s*triggerPrint/);
  });

  it("renders a top-level error banner driven by testError state", () => {
    expect(file).toMatch(/\{testError\s*&&[\s\S]{0,200}role="alert"/);
    expect(file).toMatch(/aria-live="assertive"/);
  });

  it("guards w.print() with try/catch + surfaces print-blocked errors", () => {
    expect(file).toMatch(/blocked the print dialog/);
  });

  it("preserves the three existing test-print buttons", () => {
    expect(file).toMatch(/testPrint\("receipt"\)/);
    expect(file).toMatch(/testPrint\("label"\)/);
    expect(file).toMatch(/testPrint\("office"\)/);
  });
});
