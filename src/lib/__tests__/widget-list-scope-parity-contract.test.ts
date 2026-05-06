import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for §17.1 (CONTRIBUTING.md) — widget-vs-list scope parity.
 *
 * QA finding (Desktop-Opus retest, 2026-05-06): five page-level surfaces
 * showed widget aggregations that disagreed with the list rendered
 * directly below them.
 *
 *   /sales      — widget showed $2,750; list said "No sales yet"
 *   /customers  — widget showed N customers; list rendered 0
 *   /repairs    — widget showed stage counts; list rendered 0 cards
 *   /inventory  — widget shows totals; list says "No items match"
 *   /tasks      — widget shows due counts; list rendered 0
 *
 * Root cause for /sales, /customers, /repairs: the LIST query funneled
 * through a scope helper (`locationScopeFilter` for sales/repairs,
 * `get_visible_customer_ids` for customers — both derived from
 * team_members.allowed_location_ids), but the WIDGET aggregation queries
 * ran tenant-only, so a location-restricted user saw cross-location
 * totals on the strip while their list rendered scoped (often empty).
 *
 * That's both a UX bug (numbers don't reconcile to the visible rows) and
 * a leak (the KPI surfaces totals from locations the user can't access).
 *
 * Fix: every widget aggregation that maps to a scoped list view MUST
 * apply the same scope helper as that list. The exceptions list in
 * §17.1 covers tables with no scope column (quotes, tasks pre-locating)
 * — those remain explicit tenant-wide and called out in comments.
 *
 * This test pins the contract by source-grepping the page files for the
 * scope-helper imports / callsites. Source-grep is intentionally rigid
 * — refactors that move the queries elsewhere should update this test
 * AND the §17.1 callsite list together.
 */

const repoRoot = path.resolve(__dirname, "../../..");

function readPage(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("§17.1 widget-vs-list scope parity contract", () => {
  describe("/sales/page.tsx", () => {
    const file = readPage("src/app/(app)/sales/page.tsx");

    it("imports locationScopeFilter for KPI scope parity", () => {
      expect(file).toMatch(
        /import\s+\{[^}]*\blocationScopeFilter\b[^}]*\}\s+from\s+["']@\/lib\/location-read-scope["']/,
      );
    });

    it("computes the scope filter once and applies it to KPI queries", () => {
      expect(file).toMatch(/await\s+locationScopeFilter\s*\(\s*userId\s*,\s*tenantId\s*\)/);
      // applyScope helper that gates the .or() chain on the scope filter
      expect(file).toMatch(/applyScope\s*\(/);
    });

    it("explicitly notes quotes-table tenant-wide exception", () => {
      // Quotes table has no `location_id` column (verified
      // 2026-05-06). Documented as exception in §17.1.
      expect(file).toMatch(/quotes/i);
      expect(file).toMatch(/location_id|tenant-wide/);
    });
  });

  describe("/customers/page.tsx", () => {
    const file = readPage("src/app/(app)/customers/page.tsx");

    it("CustomerKpis accepts userId + isReviewMode (visibility scope)", () => {
      expect(file).toMatch(
        /async\s+function\s+CustomerKpis\s*\(\s*\{[\s\S]*?\bisReviewMode\b[\s\S]*?\}\s*:/,
      );
    });

    it("CustomerKpis resolves visibleIds via get_visible_customer_ids RPC", () => {
      // The KPI body must call the same RPC the list (`CustomerRows`)
      // calls. Two callsites total in this file.
      const matches = file.match(/get_visible_customer_ids/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("CustomerKpis intersects KPI counts with visibleIds via .in('id', …)", () => {
      // Pattern: applyVisibility helper or inline .in("id", visibleIds)
      expect(file).toMatch(/applyVisibility\b|\.in\s*\(\s*["']id["']\s*,\s*visibleIds/);
    });
  });

  describe("/repairs/page.tsx", () => {
    const file = readPage("src/app/(app)/repairs/page.tsx");

    it("imports locationScopeFilter and computes locationFilter", () => {
      expect(file).toMatch(
        /import\s+\{[^}]*\blocationScopeFilter\b[^}]*\}\s+from\s+["']@\/lib\/location-read-scope["']/,
      );
      expect(file).toMatch(/await\s+locationScopeFilter\s*\(\s*userId\s*,\s*tenantId\s*\)/);
    });

    it("skips precomputed tenant_dashboard_stats read when locationFilter is set", () => {
      // The widget-vs-list bug: precomputed stage_counts / overdue_count
      // are tenant-wide. For restricted users we must not consume them.
      // Look for the conditional that swaps statsPromise for a null-data
      // resolved promise when locationFilter is truthy.
      expect(file).toMatch(
        /locationFilter\s*\?\s*Promise\.resolve\s*\(\s*\{\s*data:\s*null/,
      );
    });
  });

  describe("/inventory/page.tsx — already scope-consistent", () => {
    const file = readPage("src/app/(app)/inventory/page.tsx");

    it("itemsQuery and countQuery both apply locationFilter on the same branch", () => {
      // Pin the existing parity. The same `if (locationFilter) { … }`
      // block must update both queries together.
      expect(file).toMatch(
        /if\s*\(\s*locationFilter\s*\)\s*\{\s*itemsQuery\s*=\s*itemsQuery\.or\(locationFilter\);\s*countQuery\s*=\s*countQuery\.or\(locationFilter\);\s*\}/,
      );
    });
  });

  describe("/tasks/page.tsx — assigned_to scope parity", () => {
    const file = readPage("src/app/(app)/tasks/page.tsx");

    it("non-manager fetchMyTasks filters by assigned_to (per §17.1 tasks exception)", () => {
      // Tasks have no location_id column. Visibility is governed by
      // `assigned_to`. Document via this contract: non-manager listing
      // must filter by assigned_to so any KPI on the same scope agrees.
      expect(file).toMatch(/\.eq\s*\(\s*["']assigned_to["']\s*,\s*userId\s*\)/);
    });
  });

  it("CONTRIBUTING.md §17.1 lists every page-level callsite covered above", () => {
    const md = fs.readFileSync(path.join(repoRoot, "docs/CONTRIBUTING.md"), "utf8");
    expect(md).toMatch(/widget-vs-list scope parity|17\.1/i);
    // Each surface must appear by file path in the section so future
    // refactors that move the page (or remove the scope helper) trip
    // this test if the doc isn't updated in lockstep.
    expect(md).toMatch(/sales\/page\.tsx/);
    expect(md).toMatch(/customers\/page\.tsx/);
    expect(md).toMatch(/repairs\/page\.tsx/);
    expect(md).toMatch(/inventory\/page\.tsx/);
    expect(md).toMatch(/tasks\/page\.tsx/);
  });
});
