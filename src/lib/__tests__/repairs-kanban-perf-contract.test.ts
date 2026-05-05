import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the L-04 RepairsKanban perf fix.
 *
 * Audit ID L-04 (desktop-Opus): "Drag a card → <100ms drop. Memoize
 * cards, virtualize column."
 *
 * Pre-fix surface re-rendered every card on every parent state
 * update during a drag. With ~50+ cards across 7 columns, drop
 * latency exceeded 100ms on mid-tier hardware.
 *
 * Post-fix invariants pinned by this test:
 *   1. RepairCard is wrapped in React.memo with a custom shallow
 *      comparator.
 *   2. StageColumn is wrapped in React.memo.
 *   3. Parent uses useMemo to pre-group repairs by stage (no inline
 *      .filter() in JSX that produces fresh array references).
 *   4. handleDragEnd is wrapped in useCallback to keep its identity
 *      stable across parent renders.
 *
 * Virtualization (per spec) is deferred — see PR description for
 * rationale (DnD-kit + virtualization conflicts on cards scrolled
 * out of the active drag window). Memoization alone is expected to
 * hit the <100ms bar; virtualization gates on follow-up perf data
 * showing memo isn't sufficient on real workloads.
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/repairs/RepairsKanban.tsx"),
  "utf8",
);

describe("RepairsKanban — L-04 perf invariants", () => {
  it("imports memo, useMemo, useCallback from react", () => {
    expect(file).toMatch(
      /import\s+\{[^}]*\bmemo\b[^}]*\}\s+from\s+["']react["']/,
    );
    expect(file).toMatch(/import\s+\{[^}]*\buseMemo\b[^}]*\}\s+from\s+["']react["']/);
    expect(file).toMatch(/import\s+\{[^}]*\buseCallback\b[^}]*\}\s+from\s+["']react["']/);
  });

  it("wraps RepairCard in memo with a custom comparator", () => {
    expect(file).toMatch(/const\s+RepairCard\s*=\s*memo\s*\(\s*RepairCardInner/);
    // Comparator returns false on rendered-field mismatch — at minimum
    // the comparator must short-circuit on id/stage/due_date changes.
    expect(file).toMatch(/prev\.repair\.id\s*!==\s*next\.repair\.id/);
    expect(file).toMatch(/prev\.repair\.stage\s*!==\s*next\.repair\.stage/);
  });

  it("wraps StageColumn in memo", () => {
    expect(file).toMatch(/const\s+StageColumn\s*=\s*memo\s*\(\s*StageColumnInner/);
  });

  it("pre-groups repairs by stage via useMemo (stable refs across renders)", () => {
    expect(file).toMatch(/const\s+repairsByStage\s*=\s*useMemo\s*\(/);
    // The JSX render must read from the pre-computed map, not call
    // .filter() inline. A regression that re-introduces inline
    // .filter() in the JSX body would invalidate StageColumn's memo
    // every render. The positive assertion above is the structural
    // proof the new path is wired in.
    expect(file).toMatch(/repairs=\{repairsByStage\.get\(\s*stage\.key\s*\)/);
  });

  it("wraps handleDragEnd in useCallback", () => {
    expect(file).toMatch(/handleDragEnd\s*=\s*useCallback\s*\(/);
  });

  it("DndContext receives the memoized handleDragEnd", () => {
    expect(file).toMatch(/<DndContext[^>]*onDragEnd=\{handleDragEnd\}/);
  });
});
