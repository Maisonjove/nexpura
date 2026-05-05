import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-03 AI categorize confidence column.
 *
 * Audit: "AI categorize confidence column." Pre-fix, the migration
 * MappingTable rendered the ConfidenceBadge only when
 * destination_field was set — unmapped rows showed an empty cell
 * even though the AI had computed a low-confidence best-guess.
 * That read as "AI ignored this column" rather than "AI tried but
 * wasn't confident enough" and confused users.
 *
 * Post-fix: ConfidenceBadge renders for ALL rows where confidence
 * > 0, with an `unmapped` flag that shifts the label to "X% best
 * guess" + tooltip.
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/migration/_components/MappingTable.tsx"),
  "utf8",
);

describe("MappingTable — M-03 confidence rendering for all rows", () => {
  it("ConfidenceBadge accepts an unmapped flag", () => {
    expect(file).toMatch(/unmapped\?:\s*boolean/);
  });

  it("renders ConfidenceBadge for all rows with confidence > 0 (not gated on destination_field)", () => {
    // The pre-fix gate was `row.destination_field && <ConfidenceBadge`.
    // Post-fix the gate is `row.confidence > 0` and the unmapped flag
    // is derived from `!row.destination_field`.
    expect(file).toMatch(/row\.confidence\s*>\s*0\s*&&[\s\S]{0,300}<ConfidenceBadge/);
    expect(file).toMatch(/unmapped=\{!row\.destination_field\}/);
  });

  it("does NOT have the pre-fix gate `row.destination_field && <ConfidenceBadge`", () => {
    expect(file).not.toMatch(/row\.destination_field\s*&&\s*<ConfidenceBadge\s+score/);
  });

  it("badge label switches between '%' and '% best guess'", () => {
    expect(file).toMatch(/best guess/);
  });

  it("badge has a tooltip explaining the unmapped state", () => {
    expect(file).toMatch(/AI confidence too low for auto-map/);
  });
});
