import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Locks the field whitelist on the two customer-facing public routes.
 * Audit finding (Medium, preventive): a future refactor could widen
 * the projection to `select("*")` or add a field like `internal_notes`
 * / `cost_price` / `margin_pct` and accidentally leak to the customer.
 * These tests statically analyse the two routes' source and fail if
 * any forbidden pattern appears.
 */

const trackPage = fs.readFileSync(
  path.resolve(__dirname, "../../app/track/[trackingId]/page.tsx"),
  "utf8",
);
const approvePage = fs.readFileSync(
  path.resolve(__dirname, "../../app/approve/[token]/page.tsx"),
  "utf8",
);

const FORBIDDEN_FIELDS = [
  "internal_notes",
  "cost_price",
  "wholesale_price",
  "margin_pct",
  "staff_comments",
  "markup",
];

describe("/track/[id] response whitelist", () => {
  it("does NOT fetch any internal/sensitive field", () => {
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(trackPage).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it("does NOT use a wildcard select on repairs/bespoke_jobs/order_attachments/order_status_history", () => {
    const wildcardSelects = trackPage.match(/\.from\(["'](?:repairs|bespoke_jobs|order_attachments|order_status_history)["']\)[\s\S]{0,200}?\.select\(["'`]\*/g);
    expect(wildcardSelects).toBeNull();
  });

  it("enforces format guard on tracking id (only RPR-/BSP- hex prefixes)", () => {
    expect(trackPage).toMatch(/\/\^\(RPR\|BSP\)-\[A-F0-9\]/);
  });

  it("rate-limits the public endpoint", () => {
    expect(trackPage).toMatch(/checkRateLimit\(`track:/);
  });

  it("honours tracking_revoked_at kill-switch", () => {
    expect(trackPage).toMatch(/tracking_revoked_at/);
  });
});

describe("/approve/[token] response whitelist", () => {
  it("does NOT fetch any internal/sensitive field", () => {
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(approvePage).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it("does NOT use a wildcard select on bespoke_jobs", () => {
    const wildcardSelects = approvePage.match(/\.from\(["']bespoke_jobs["']\)[\s\S]{0,200}?\.select\(["'`]\*/g);
    expect(wildcardSelects).toBeNull();
  });

  it("renders branded invalid-state (ApprovalInvalid), not login", () => {
    expect(approvePage).toMatch(/ApprovalInvalid/);
    expect(approvePage).toMatch(/Invalid or Expired Approval Link/);
  });
});
