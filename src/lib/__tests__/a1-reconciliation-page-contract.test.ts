/**
 * A1 Day 3 — /financials/reconciliation page contract.
 *
 * Source-text pin on the page's permission gate + feature-flag check.
 * Ensures a future refactor can't silently widen access to staff
 * (the page exposes deltas across financial views — owner+manager
 * only) or expose pre-A1 tenants to a half-implemented surface.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "app",
    "(app)",
    "financials",
    "reconciliation",
    "page.tsx",
  ),
  "utf8",
);

const CLIENT = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "app",
    "(app)",
    "financials",
    "reconciliation",
    "ReconciliationClient.tsx",
  ),
  "utf8",
);

describe("A1 reconciliation page — permission gate", () => {
  it("redirects to /login when no tenant or no user", () => {
    expect(PAGE).toMatch(/if\s*\(\s*!tenantId\s*\|\|\s*!userId\s*\)\s*redirect\(["']\/login["']\)/);
  });

  it("redirects to /financials when role is not owner or manager", () => {
    // The page is higher-priv than /financials (exposes cross-view deltas).
    expect(PAGE).toMatch(
      /if\s*\(\s*role\s*!==\s*["']owner["']\s*&&\s*role\s*!==\s*["']manager["']\s*\)\s*\{[\s\S]{0,200}?redirect\(["']\/financials["']\)/,
    );
  });
});

describe("A1 reconciliation page — feature flag gate", () => {
  it("reads tenants.a1_money_correctness BEFORE running the aggregator", () => {
    const flagPos = PAGE.search(/a1_money_correctness/);
    const aggPos = PAGE.search(/getReconciliationTotals/);
    expect(flagPos).toBeGreaterThan(0);
    expect(aggPos).toBeGreaterThan(flagPos);
  });

  it("renders a 'staged rollout' notice when flag is FALSE — does NOT call the aggregator", () => {
    expect(PAGE).toMatch(
      /!tenant\?\.a1_money_correctness[\s\S]{0,500}?staged rollout/i,
    );
  });
});

describe("A1 reconciliation page — date range handling", () => {
  it("defaults to current calendar month when no query params supplied", () => {
    expect(PAGE).toMatch(/startOfMonthIso/);
    expect(PAGE).toMatch(/startOfNextMonthIso/);
  });

  it("validates user-supplied dates (YYYY-MM-DD) and falls back on bad input", () => {
    // Cluster-PR item 8 (R5-F4): regex now has capture groups so the
    // function can also extract the year and validate it's <= 9999.
    // The literal pattern is still anchored YYYY-MM-DD.
    expect(PAGE).toMatch(/parseDateOrFallback/);
    expect(PAGE).toMatch(/\^\(?\\d\{4\}\)?-\(?\\d\{2\}\)?-\(?\\d\{2\}\)?\$/);
  });
});

describe("A1 reconciliation page — aggregator wiring", () => {
  it("calls getReconciliationTotals with (admin, tenantId, range)", () => {
    expect(PAGE).toMatch(
      /getReconciliationTotals\(admin,\s*tenantId,\s*\{[\s\S]{0,80}?fromIso,[\s\S]{0,80}?toIso/,
    );
  });

  it("passes server-built rows to ReconciliationClient (no client-side fetching)", () => {
    expect(PAGE).toMatch(/<ReconciliationClient/);
    expect(PAGE).toMatch(/buildReconciliationRows\(totals\)/);
  });
});

describe("A1 reconciliation client — table rendering", () => {
  it("renders a table with data-testid for QA + 5 columns", () => {
    expect(CLIENT).toMatch(/data-testid="reconciliation-table"/);
    // Check the column headers (Check / Expected / Actual / Δ / Status).
    expect(CLIENT).toMatch(/>Check</);
    expect(CLIENT).toMatch(/>Expected</);
    expect(CLIENT).toMatch(/>Actual</);
    expect(CLIENT).toMatch(/>Δ</);
    expect(CLIENT).toMatch(/>Status</);
  });

  it("colours rows by isMatch (green=match, red=delta)", () => {
    // Match badge: green-100 text-green-800
    expect(CLIENT).toMatch(/bg-green-100\s+text-green-800/);
    // Delta row: red-50/red-100 background + red-700/red-800 text
    expect(CLIENT).toMatch(/bg-red-100\s+text-red-800/);
  });

  it("does NOT fetch data client-side (server-aggregator is single source)", () => {
    // Per A1 H-02 contract, all 4 reconciled views project from the
    // server aggregator. Pin that the client doesn't have its own
    // fetch loop.
    expect(CLIENT).not.toMatch(/useEffect\([\s\S]{0,300}?fetch\(/);
    expect(CLIENT).not.toMatch(/useSWR\(|useQuery\(/);
  });
});
