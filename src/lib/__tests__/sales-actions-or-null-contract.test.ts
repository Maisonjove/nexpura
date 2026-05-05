import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the C-02 OR-NULL hygiene refactor of getSales.
 *
 * Pre-fix sales-actions.ts applied a strict `.in("location_id",
 * locationIds)` even when locationIds was the SCOPE-derived
 * restriction (no user-explicit filter). That excluded
 * `location_id IS NULL` rows for restricted users — most legacy
 * pre-column rows AND any sale created by a tenant without a default
 * location selected.
 *
 * Post-fix the scope-derived case uses `locationScopeFilter` from
 * src/lib/location-read-scope.ts which produces an OR-NULL .or()
 * expression. The user-explicit-filter branch keeps the strict .in()
 * because the user explicitly chose a location subset and wants only
 * those.
 *
 * This test pins the contract so a future edit can't accidentally
 * regress sales-actions.ts back to the strict-`.in` shape on the
 * scope-derived path.
 */

const file = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/sales/sales-actions.ts"),
  "utf8",
);

describe("sales-actions.ts — C-02 OR-NULL hygiene", () => {
  it("imports locationScopeFilter from location-read-scope", () => {
    expect(file).toMatch(
      /import\s+\{[^}]*\blocationScopeFilter\b[^}]*\}\s+from\s+["']@\/lib\/location-read-scope["']/,
    );
  });

  it("calls locationScopeFilter on the scope-derived path", () => {
    expect(file).toMatch(/await\s+locationScopeFilter\s*\(/);
  });

  it("applies the scope filter via query.or(scopeOrFilter) BEFORE the .in() block", () => {
    const orPos = file.search(/query\.or\(\s*scopeOrFilter/);
    const inPos = file.search(/query\.in\s*\(\s*["']location_id["']/);
    expect(orPos).toBeGreaterThan(0);
    expect(inPos).toBeGreaterThan(orPos);
  });

  it("returns early when user-explicit intersection with scope is empty (unchanged contract)", () => {
    expect(file).toMatch(/intersection empty/);
    // Post-#161 the return shape is the SalesListPage object (sales/nextCursor/hasMore)
    // rather than a bare array. Match either to keep this contract stable
    // across the cursor-pagination refactor.
    expect(file).toMatch(/return\s+(\[\]|\{\s*sales:\s*\[\])/);
  });

  it("does NOT substitute the impossible UUID '00000000-…' into locationIds", () => {
    // Pre-fix the empty-allowed branch did:
    //   locationIds = scope.allowedIds.length > 0 ? … : ["00000000-…"]
    // The hygiene refactor moves that fallthrough into
    // locationScopeFilter (where it stays inside the .or() expression
    // — the impossible UUID is still right for empty-allowed users,
    // but it's no longer mixed up with user-explicit input).
    const sourceLines = file.split("\n");
    const offendingLines = sourceLines.filter(
      (l) =>
        l.includes("00000000-0000-0000-0000-000000000000") &&
        l.includes("locationIds"),
    );
    expect(offendingLines).toEqual([]);
  });
});
