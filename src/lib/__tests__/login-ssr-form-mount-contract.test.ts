/**
 * Contract test for QA-301 — login form must be in the static SSR HTML.
 *
 * The bug: previously the entire `LoginPageContent` was wrapped in a
 * `<Suspense fallback={…splash…}>` because it called `useSearchParams()`
 * at the top of the component. Under static prerender this caused Next
 * to emit ONLY the fallback splash in the SSR HTML for `/login`, leaving
 * the `<form>` to be rendered later — once React hydrated on the client.
 * On WebKit/Safari, hydration is measurably slower than on Chromium and
 * Firefox, so users (and Playwright `smoke.spec.ts:4` / `:78`) saw a
 * persistent splash and a missing form.
 *
 * The fix isolates `useSearchParams()` into a tiny `<ExpiredSessionBanner>`
 * child with its own Suspense boundary; the form itself no longer reads
 * search params, so its mark-up is part of the static SSR HTML and shows
 * up immediately on first paint regardless of browser hydration speed.
 *
 * This is a lock-test — it fails if a future edit re-introduces the
 * page-level Suspense wrapper around the form.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("login page — form must mount in SSR (QA-301)", () => {
  const src = readSrc("src/app/(auth)/login/page.tsx");

  it("default export does NOT wrap the form in a top-level Suspense", () => {
    // Find the default export body.
    const match = src.match(
      /export\s+default\s+function\s+LoginPage\s*\([^)]*\)\s*\{([\s\S]*?)\n\}\s*$/
    );
    expect(match).toBeTruthy();
    const body = match ? match[1] : "";
    // The default export must render <LoginForm /> directly, NOT a
    // <Suspense>…fallback wrapping the form.
    expect(body).toMatch(/<LoginForm\s*\/>/);
    expect(body).not.toMatch(/<Suspense\b/);
  });

  it("does NOT keep the old splash fallback (which is what stuck Safari users)", () => {
    // The old fallback contained an `animate-pulse` skeleton inside the
    // Suspense fallback prop. After the fix, the only animate-pulse
    // string allowed in this file is none — the splash is gone.
    expect(src).not.toMatch(/fallback=\{[\s\S]*animate-pulse/);
  });

  it("isolates useSearchParams() into a child component, not the form", () => {
    // Strip comments before counting so doc-string mentions don't
    // count as call sites.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    // The actual call must appear exactly once.
    const callSites = stripped.match(/useSearchParams\s*\(/g) || [];
    expect(callSites.length).toBe(1);

    // It must live inside ExpiredSessionBanner, not LoginForm.
    const bannerStart = stripped.indexOf("function ExpiredSessionBanner");
    expect(bannerStart).toBeGreaterThanOrEqual(0);
    const nextFn = stripped.indexOf("\nfunction ", bannerStart + 1);
    expect(nextFn).toBeGreaterThan(bannerStart);
    const bannerBlock = stripped.slice(bannerStart, nextFn);
    expect(bannerBlock).toMatch(/useSearchParams\s*\(/);

    const formStart = stripped.indexOf("function LoginForm");
    expect(formStart).toBeGreaterThan(nextFn - 1);
    const afterForm = stripped.indexOf("\nfunction ", formStart + 1);
    const formEnd =
      afterForm > 0 ? afterForm : stripped.indexOf("\nexport default", formStart);
    expect(formEnd).toBeGreaterThan(formStart);
    const formBlock = stripped.slice(formStart, formEnd);
    expect(formBlock).not.toMatch(/useSearchParams\s*\(/);
  });

  it("wraps ExpiredSessionBanner in Suspense (so static prerender succeeds)", () => {
    // The banner reads useSearchParams, so Next still requires it to be
    // inside a Suspense boundary. Confirm it is.
    expect(src).toMatch(
      /<Suspense[^>]*fallback=\{[^}]*\}[\s>]*[\s\S]{0,80}<ExpiredSessionBanner\s*\/>/
    );
  });

  it("preserves the email/password inputs (smoke regression guard)", () => {
    // What the failing Playwright smoke spec was asserting — the inputs
    // exist in the source so the SSR HTML will include them.
    expect(src).toMatch(/<input[^>]*type="email"/);
    expect(src).toMatch(/<input[^>]*type="password"/);
    expect(src).toMatch(/aria-label="Login form"/);
  });
});
