import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for `addLocFilter` in src/app/(app)/dashboard/actions.ts.
 *
 * Sibling fix to PR #203 (post-audit/widget-list-reconciliation,
 * CONTRIBUTING.md §17.1) — same scope-bypass shape on the multi-location
 * dashboard widget path. PR #203 fixed /sales, /customers, /repairs;
 * this pins the dashboard.
 *
 * Pre-fix bug: the in-file `addLocFilter` helper honoured ONLY the
 * user-explicit location picker (the `locationIds` arg flowing in from
 * `getFilterLocationIds()` in DashboardWrapper.tsx). It never read
 * `team_members.allowed_location_ids`, so a restricted team member
 * whose picker was "all" saw tenant-wide widgets — the precomputed
 * `tenant_dashboard_stats` fast-path PLUS the live-query path both
 * ran tenant-only.
 *
 * Post-fix:
 *   1. `getDashboardStats` resolves the user's allowed scope via
 *      `resolveReadLocationScope` and intersects it with the
 *      explicit picker before passing into `fetchDashboardStats`.
 *   2. `addLocFilter` applies C-02 OR-NULL hygiene
 *      (`location_id.in.(...) | location_id.is.null`) so legacy
 *      pre-location rows remain visible to the restricted user —
 *      same shape as `locationScopeFilter` in /sales, /repairs,
 *      /inventory.
 *   3. The precomputed-row fast path (in `readPrecomputedStats` and
 *      in the `/api/dashboard/stats` route handler) is skipped for
 *      restricted users because the precomputed aggregate is
 *      tenant-wide.
 *
 * Source-grep style: refactors that move the helper or rename the
 * import MUST update this test in lockstep.
 */

const repoRoot = path.resolve(__dirname, "../../..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("§17.1 sibling — dashboard addLocFilter scope parity contract", () => {
  describe("src/app/(app)/dashboard/actions.ts", () => {
    const file = readFile("src/app/(app)/dashboard/actions.ts");

    it("imports resolveReadLocationScope for scope resolution", () => {
      expect(file).toMatch(
        /import\s+\{[^}]*\bresolveReadLocationScope\b[^}]*\}\s+from\s+["']@\/lib\/location-read-scope["']/,
      );
    });

    it("getDashboardStats resolves the caller's scope before dispatch", () => {
      // Both the explicit picker and team_members.allowed_location_ids
      // must be consulted. The intersection is the "effective" set.
      expect(file).toMatch(
        /await\s+resolveReadLocationScope\s*\(\s*userId\s*,\s*tenantId\s*\)/,
      );
    });

    it("intersects the picker with allowed_location_ids", () => {
      // Restricted users with an "all" picker must scope to their
      // allowed set; restricted users whose picker selects an ID
      // outside their allowed set must drop the disallowed IDs.
      expect(file).toMatch(/allowedSet/);
      expect(file).toMatch(/effectiveIds/);
    });

    it("skips precomputed tenant_dashboard_stats read for restricted users", () => {
      // Precomputed row is tenant-wide. Consuming it for a
      // location-restricted user re-introduces the pre-fix leak.
      // The conditional must gate on `scope.all`.
      expect(file).toMatch(/scope\.all\s*&&[^}]*readPrecomputedStats/);
    });

    it("addLocFilter applies OR-NULL hygiene (C-02 pattern)", () => {
      // Canonical shape from locationScopeFilter:
      //   `location_id.in.(${ids.join(",")}),location_id.is.null`
      // Refactors that drop the OR-NULL branch will hide legacy
      // rows from restricted users — that's a regression.
      expect(file).toMatch(
        /location_id\.in\.\(\$\{[^}]*\.join\(["']?,["']?\)\}\),location_id\.is\.null/,
      );
    });

    it("addLocFilter handles empty effective set with impossible-UUID match-nothing", () => {
      // Mirrors locationScopeFilter's
      //   "location_id.eq.00000000-0000-0000-0000-000000000000"
      // semantics so a no-overlap intersection produces zero rows
      // symmetrically with the other surfaces.
      expect(file).toMatch(/00000000-0000-0000-0000-000000000000/);
    });

    it("getDashboardStats remains exported (consumed by DashboardWrapper + getDashboardData)", () => {
      expect(file).toMatch(/export\s+async\s+function\s+getDashboardStats\b/);
    });
  });

  describe("src/app/api/dashboard/stats/route.ts", () => {
    const file = readFile("src/app/api/dashboard/stats/route.ts");

    it("imports resolveReadLocationScope to gate the precomputed fast path", () => {
      expect(file).toMatch(
        /import\s+\{[^}]*\bresolveReadLocationScope\b[^}]*\}\s+from\s+["']@\/lib\/location-read-scope["']/,
      );
    });

    it("returns stale={location_restricted} for restricted users", () => {
      // SWR fetcher in DashboardWrapper falls through to the
      // server-action live path on `stale: true`. That live path
      // applies the OR-NULL hygiene fix in addLocFilter.
      expect(file).toMatch(/location_restricted/);
      expect(file).toMatch(/!scope\.all/);
    });
  });
});
