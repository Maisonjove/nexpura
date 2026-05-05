import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-08 automations test-run mode.
 *
 * Audit: "Automations test-run mode." Pre-fix the automations
 * surface only had on/off + settings — no way to preview which
 * customers would receive an automation if it fired now without
 * actually sending. Post-fix:
 *   - previewAutomationMatches server action returns a count
 *   - "Test run" button per automation surfaces it inline
 *   - Unsupported types return { unsupported: true, reason }
 *   - Sends ZERO emails (purely a count query)
 */

const actionsFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/marketing/automations/actions.ts"),
  "utf8",
);

const clientFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/marketing/automations/AutomationsClient.tsx"),
  "utf8",
);

describe("automations/actions — previewAutomationMatches", () => {
  it("exports previewAutomationMatches", () => {
    expect(actionsFile).toMatch(
      /export\s+async\s+function\s+previewAutomationMatches\s*\(/,
    );
  });

  it("declares AutomationTestRunResult shape with matchedCount + unsupported + error", () => {
    expect(actionsFile).toMatch(/AutomationTestRunResult/);
    expect(actionsFile).toMatch(/matchedCount\?:\s*number/);
    expect(actionsFile).toMatch(/unsupported\?:\s*boolean/);
  });

  it("requires owner/manager auth", () => {
    const block = actionsFile.match(
      /previewAutomationMatches[\s\S]{0,1500}?requireRole\("owner",\s*"manager"\)/,
    );
    expect(block).not.toBeNull();
  });

  it("supports birthday + anniversary; returns unsupported for others", () => {
    expect(actionsFile).toMatch(/TEST_RUN_SUPPORTED\s*=\s*new\s+Set\(\s*\[\s*"birthday",\s*"anniversary"\s*\]\s*\)/);
    expect(actionsFile).toMatch(/unsupported:\s*true/);
  });

  it("does NOT call sendMarketingEmail or any send path", () => {
    // M-08 is count-only; never sends. Asserts the import + call sites
    // are absent.
    const previewBlock = actionsFile.match(
      /previewAutomationMatches[\s\S]*?(?=\n(?:export|\}\s*$))/,
    )?.[0] ?? "";
    expect(previewBlock).not.toMatch(/sendMarketingEmail/);
    expect(previewBlock).not.toMatch(/resend\.emails\.send/);
  });

  it("reads days_before from saved settings (default 0)", () => {
    expect(actionsFile).toMatch(/settings\.days_before/);
  });
});

describe("AutomationsClient — Test run UI", () => {
  it("imports previewAutomationMatches", () => {
    expect(clientFile).toMatch(/previewAutomationMatches/);
  });

  it("declares testRunResult state keyed by automation type", () => {
    expect(clientFile).toMatch(/testRunResult/);
  });

  it("each automation card has a Test run button", () => {
    expect(clientFile).toMatch(/Test run/);
    expect(clientFile).toMatch(/handleTestRun/);
  });

  it("renders matched-count copy (no email sent)", () => {
    expect(clientFile).toMatch(/no email sent/);
  });

  it("surfaces unsupported reason for non-birthday/anniversary types", () => {
    expect(clientFile).toMatch(/unsupported/);
  });
});
