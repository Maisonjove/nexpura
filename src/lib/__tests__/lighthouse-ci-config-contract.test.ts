import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the Phase E Lighthouse CI configuration.
 *
 * Pins the perf budgets so a future config edit can't silently
 * loosen them past the thresholds Joey expects to hold for the
 * customer-facing pages. Update budgets when intentional; a
 * regression here means someone bumped the budget without
 * updating the test.
 */

const lhrcPath = path.resolve(__dirname, "../../../lighthouserc.json");
const budgetsPath = path.resolve(__dirname, "../../../lighthouse-budgets.json");
const workflowPath = path.resolve(__dirname, "../../../.github/workflows/lighthouse.yml");

describe("lighthouserc.json — assertion thresholds", () => {
  const cfg = JSON.parse(fs.readFileSync(lhrcPath, "utf8"));

  it("scans the canonical entry surfaces (home, login, signup, features, pricing)", () => {
    const urls: string[] = cfg.ci.collect.url;
    expect(urls.some((u) => u.endsWith("/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/signup"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/features"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/pricing"))).toBe(true);
  });

  it("runs each URL multiple times for variance smoothing", () => {
    expect(cfg.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(3);
  });

  it("requires LCP ≤ 2.5s (error-level)", () => {
    const lcp = cfg.ci.assert.assertions["largest-contentful-paint"];
    expect(lcp[0]).toBe("error");
    expect(lcp[1].maxNumericValue).toBeLessThanOrEqual(2500);
  });

  it("requires TBT ≤ 300ms (error-level)", () => {
    const tbt = cfg.ci.assert.assertions["total-blocking-time"];
    expect(tbt[0]).toBe("error");
    expect(tbt[1].maxNumericValue).toBeLessThanOrEqual(300);
  });

  it("requires CLS ≤ 0.1 (error-level)", () => {
    const cls = cfg.ci.assert.assertions["cumulative-layout-shift"];
    expect(cls[0]).toBe("error");
    expect(cls[1].maxNumericValue).toBeLessThanOrEqual(0.1);
  });

  it("requires perf score ≥ 0.85 + a11y ≥ 0.9 (error-level)", () => {
    const perf = cfg.ci.assert.assertions["categories:performance"];
    const a11y = cfg.ci.assert.assertions["categories:accessibility"];
    expect(perf[0]).toBe("error");
    expect(perf[1].minScore).toBeGreaterThanOrEqual(0.85);
    expect(a11y[0]).toBe("error");
    expect(a11y[1].minScore).toBeGreaterThanOrEqual(0.9);
  });
});

describe("lighthouse-budgets.json — resource budgets", () => {
  const budgets = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));

  it("caps total wire weight at ≤ 1.5 MB", () => {
    const total = budgets[0].resourceSizes.find(
      (r: { resourceType: string }) => r.resourceType === "total",
    );
    expect(total.budget).toBeLessThanOrEqual(1500);
  });

  it("caps script weight at ≤ 350 KB", () => {
    const script = budgets[0].resourceSizes.find(
      (r: { resourceType: string }) => r.resourceType === "script",
    );
    expect(script.budget).toBeLessThanOrEqual(350);
  });

  it("caps image weight at ≤ 400 KB (post-Next/Image, all routes share this)", () => {
    const image = budgets[0].resourceSizes.find(
      (r: { resourceType: string }) => r.resourceType === "image",
    );
    expect(image.budget).toBeLessThanOrEqual(400);
  });
});

describe("GitHub workflow — runs on push + PR", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  it("triggers on push to main and on pull_request", () => {
    expect(workflow).toMatch(/push:[\s\S]*?branches:\s*\[main\]/);
    expect(workflow).toMatch(/pull_request:[\s\S]*?branches:\s*\[main\]/);
  });

  it("uses @lhci/cli with a pinned major version", () => {
    expect(workflow).toMatch(/@lhci\/cli@\d+(\.\d+)?/);
  });

  it("references the lighthouserc.json", () => {
    expect(workflow).toMatch(/lighthouserc\.json/);
  });
});
