import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test: every detail page for a location-scoped entity must
 * import resolveReadLocationScope AND call it as a read-guard after
 * fetching the row. Blocks the URL-typing bypass where a restricted
 * user manually types another location's UUID into the URL.
 */

const pages = [
  "src/app/(app)/repairs/[id]/page.tsx",
  "src/app/(app)/bespoke/[id]/page.tsx",
  "src/app/(app)/inventory/[id]/page.tsx",
  "src/app/(app)/invoices/[id]/page.tsx",
  "src/app/(app)/sales/[id]/page.tsx",
];

function readPage(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../", rel), "utf8");
}

describe("detail-page location read-guards (blocker 1)", () => {
  for (const p of pages) {
    describe(p, () => {
      const src = readPage(p);

      it("imports resolveReadLocationScope", () => {
        expect(src).toMatch(/from\s+["']@\/lib\/location-read-scope["']/);
        expect(src).toMatch(/resolveReadLocationScope/);
      });

      it("calls notFound() when the row's location is outside the user's scope", () => {
        // Either: explicit includes-check after scope.all guard,
        // or a filter-in-query pattern. Both are accepted.
        const hasIncludesCheck = /scope\.allowedIds\.includes/.test(src);
        const hasFilterInQuery = /locationScopeFilter/.test(src);
        expect(hasIncludesCheck || hasFilterInQuery).toBe(true);
      });

      it("falls through for legacy rows with location_id=NULL", () => {
        // The guard must be gated on `row.location_id` being truthy so
        // tenant-wide (pre-migration) rows stay visible.
        const locIdGuarded = /location_id(?:\])?[\s)]/.test(src) &&
          /if\s*\([^)]*location_id/.test(src);
        expect(locIdGuarded).toBe(true);
      });

      it("has not broken the existing notFound() / redirect() flow", () => {
        expect(src).toMatch(/notFound\(\)/);
      });
    });
  }
});
