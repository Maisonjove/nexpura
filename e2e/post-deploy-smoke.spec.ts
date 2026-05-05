/**
 * Post-deploy smoke test — closes cleanup-track item #24.
 *
 * Catches the "stale-SW dashboard crash" failure mode that hit Joey on
 * the e68a06b deploy: a logged-in user navigates to /nexpura/dashboard
 * and the page renders cleanly — no global-error.tsx fallback, no
 * "Something went wrong" copy, real Workspace heading visible.
 *
 * The test launches a fresh browser context with no storage state so
 * we always start from a clean slate (no cookies, no SW, no cache).
 *
 * Wired to `pnpm smoke:dashboard`. Defaults to BASE_URL or
 * http://localhost:3000; point it at prod with:
 *   BASE_URL=https://nexpura.com pnpm smoke:dashboard
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.SMOKE_EMAIL ?? "hello@nexpura.com";
const TEST_PASSWORD = process.env.SMOKE_PASSWORD ?? "Test123456";
const TARGET_PATH = process.env.SMOKE_DASHBOARD_PATH ?? "/nexpura/dashboard";

test.describe("post-deploy smoke", () => {
  // Force a fresh context with no persisted storage — we want to catch
  // first-time-after-deploy renders, not warm-cache hits.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("dashboard loads cleanly for logged-in user", async ({ page }) => {
    // 1. Log in.
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for the post-login redirect to settle (could be a tenant
    // dashboard, an admin redirect, or the explicit target).
    await page.waitForLoadState("networkidle");

    // 2. Navigate to the dashboard explicitly.
    const response = await page.goto(TARGET_PATH);
    await page.waitForLoadState("networkidle");

    // 3. Final URL should be the dashboard (allowing the 307 redirect
    //    chain Next sometimes emits for protected routes).
    expect(page.url()).toContain("/dashboard");

    // 4. Final response in the chain should be a 2xx.
    if (response) {
      expect(response.status(), "dashboard response status").toBeLessThan(400);
    }

    // 5. The page must render an h1 containing "Workspace" (case-insensitive).
    //    This is the live-marker that the dashboard rendered successfully —
    //    if global-error.tsx fired, we'd see "Something went wrong" instead.
    await expect(
      page.locator("h1").filter({ hasText: /workspace/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // 6. None of the error-boundary copy may appear anywhere on the page.
    const body = await page.locator("body").innerText();
    expect(body, "dashboard body should not contain global-error copy").not.toMatch(
      /Something went wrong/i,
    );
    expect(body, "dashboard body should not contain global-error copy").not.toMatch(
      /We've been notified about this issue/i,
    );
  });
});
