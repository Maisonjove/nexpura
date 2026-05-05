import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-07 segments empty-validation fix.
 *
 * Audit: "Segments builder allows empty segments to save → Required:
 * at least one rule." Pre-fix the server accepted any rules object
 * including `{}` and `{ type: "custom" }`; the client default
 * rule_type was "custom" (not in the dropdown), so submit-without-
 * change persisted an empty segment.
 *
 * Post-fix invariants pinned by this test.
 */

const actionsFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/marketing/segments/actions.ts"),
  "utf8",
);

const clientFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/marketing/segments/SegmentsClient.tsx"),
  "utf8",
);

describe("segments/actions — server-side validation", () => {
  it("declares SEGMENT_RULE_TYPES whitelist", () => {
    expect(actionsFile).toMatch(/SEGMENT_RULE_TYPES\s*=\s*\[/);
    expect(actionsFile).toMatch(/"new"/);
    expect(actionsFile).toMatch(/"lapsed"/);
    expect(actionsFile).toMatch(/"high_value"/);
    expect(actionsFile).toMatch(/"vip"/);
    expect(actionsFile).toMatch(/"repair"/);
  });

  it("does NOT include 'custom' in the whitelist", () => {
    // The pre-fix bug: rule_type='custom' produced a segment that
    // matched no customers. Post-fix custom is rejected.
    const whitelist = actionsFile.match(/SEGMENT_RULE_TYPES\s*=\s*\[[^\]]+\]/)?.[0] ?? "";
    expect(whitelist).not.toMatch(/"custom"/);
  });

  it("validateSegmentRules rejects missing/invalid type", () => {
    expect(actionsFile).toMatch(/Choose a valid segment type\./);
  });

  it("validates the type-specific qualifier for each parameterised type", () => {
    expect(actionsFile).toMatch(/positive 'days' value/);
    expect(actionsFile).toMatch(/positive 'months' value/);
    expect(actionsFile).toMatch(/positive minimum-purchase amount/);
    expect(actionsFile).toMatch(/percentile between 1 and 100/);
  });

  it("createSegment calls validateSegmentRules before insert", () => {
    const createBlock = actionsFile.match(
      /export\s+async\s+function\s+createSegment[\s\S]*?const\s+ruleErr\s*=\s*validateSegmentRules\(data\.rules\)/,
    );
    expect(createBlock).not.toBeNull();
  });

  it("updateSegment calls validateSegmentRules when rules are being changed", () => {
    const updateBlock = actionsFile.match(
      /export\s+async\s+function\s+updateSegment[\s\S]*?validateSegmentRules\(data\.rules\)/,
    );
    expect(updateBlock).not.toBeNull();
  });

  it("rejects empty segment name", () => {
    expect(actionsFile).toMatch(/Segment name is required/);
  });
});

describe("SegmentsClient — UI invariants", () => {
  it("initial rule_type matches a real dropdown option (NOT 'custom')", () => {
    // Initial useState must default to one of the dropdown options
    // ('new', 'lapsed', etc.). The pre-fix default 'custom' is forbidden.
    const initialBlock = clientFile.match(
      /useState\(\s*\{\s*name:[^}]*rule_type:\s*"([^"]+)"/,
    );
    expect(initialBlock).not.toBeNull();
    expect(initialBlock?.[1]).not.toBe("custom");
  });

  it("renders inline error from createError state", () => {
    expect(clientFile).toMatch(/createError\s*&&[\s\S]{0,200}role="alert"/);
  });

  it("validates rule-value > 0 client-side before calling createSegment", () => {
    expect(clientFile).toMatch(/Enter a positive value for the segment rule/);
  });
});
