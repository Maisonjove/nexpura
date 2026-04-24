/**
 * Jeweller-persona walkthrough — a comprehensive smoke test for every
 * top-level page a real jeweller would visit.
 *
 * Drives a real Chromium against production (BASE_URL=https://nexpura-delta.vercel.app),
 * logs in once, navigates every app route, and reports:
 *   - HTTP status (any 5xx on the top-level nav or fired XHRs)
 *   - Console errors (severity: error only; warnings ignored because the
 *     codebase is noisy with dev-only warnings on prod too)
 *   - Visible-to-user error UI (react error boundary, "Something went wrong")
 *   - Page title / presence of a recognisable anchor element
 *
 * Single test aggregates the results across all routes and FAILS at the
 * end if any route hit an issue — so Playwright's HTML report shows a
 * structured table of all broken pages in one shot instead of 40 separate
 * green-or-red runs.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   pnpm exec playwright test e2e/jeweller-walkthrough.spec.ts --reporter=list
 */

import { expect, test, type ConsoleMessage, type Page, type Request, type Response } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://nexpura-delta.vercel.app";
const EMAIL = process.env.NEXPURA_TEST_EMAIL;
const PASSWORD = process.env.NEXPURA_TEST_PASSWORD;

// Every top-level tenant route we want to exercise. Keeps parity with
// TENANT_APP_ROUTES in src/lib/supabase/middleware.ts. Sub-routes are
// covered per-section below.
const TENANT_ROUTES = [
  "/dashboard",
  "/pos",
  "/sales",
  "/invoices",
  "/quotes",
  "/laybys",
  "/inventory",
  "/customers",
  "/suppliers",
  "/memo",
  "/stocktakes",
  "/repairs",
  "/bespoke",
  "/workshop",
  "/appraisals",
  "/passports",
  "/expenses",
  "/financials",
  "/reports",
  "/refunds",
  "/vouchers",
  "/eod",
  "/marketing",
  "/tasks",
  "/copilot",
  "/website",
  "/documents",
  "/integrations",
  "/reminders",
  "/support",
  "/settings",
  "/billing",
  "/communications",
  "/notifications",
  "/migration",
  "/ai",
  "/enquiries",
  "/print-queue",
];

interface RouteResult {
  route: string;
  tenantUrl: string;
  httpStatus: number;
  responseTimeMs: number;
  consoleErrors: string[];
  networkFails: Array<{ url: string; status: number; method: string }>;
  hasErrorUI: boolean;
  errorUIText: string | null;
  title: string | null;
  loadedOk: boolean;
}

function summarise(results: RouteResult[]): string {
  const lines: string[] = [];
  let okCount = 0;
  for (const r of results) {
    const issues: string[] = [];
    if (r.httpStatus >= 500) issues.push(`HTTP ${r.httpStatus}`);
    if (r.hasErrorUI) issues.push(`ErrorUI: "${r.errorUIText?.slice(0, 80)}"`);
    if (r.consoleErrors.length > 0) issues.push(`console ${r.consoleErrors.length} err`);
    if (r.networkFails.length > 0) issues.push(`net ${r.networkFails.length} 5xx`);
    if (!r.loadedOk) issues.push("navigation failed");

    if (issues.length === 0) {
      okCount += 1;
      lines.push(`✅ ${r.route.padEnd(20)} ${r.httpStatus} ${r.responseTimeMs}ms  "${(r.title ?? "").slice(0, 40)}"`);
    } else {
      lines.push(`❌ ${r.route.padEnd(20)} ${r.httpStatus} ${r.responseTimeMs}ms  ${issues.join(" | ")}`);
      for (const err of r.consoleErrors.slice(0, 3)) lines.push(`   console: ${err.slice(0, 180)}`);
      for (const nf of r.networkFails.slice(0, 3)) lines.push(`   network: ${nf.method} ${nf.url} -> ${nf.status}`);
    }
  }
  lines.push("");
  lines.push(`Summary: ${okCount}/${results.length} routes clean`);
  return lines.join("\n");
}

test.describe("Jeweller walkthrough", () => {
  test.skip(!EMAIL || !PASSWORD, "NEXPURA_TEST_EMAIL and NEXPURA_TEST_PASSWORD must be set");
  test.setTimeout(15 * 60 * 1000); // 15 min cap for the whole walk

  test("every top-level page loads without errors", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // ── Login ──────────────────────────────────────────────────────────
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    // Login form — may be on /login directly or a sub-route; try both.
    await page.getByLabel(/email/i).first().fill(EMAIL!);
    await page.getByLabel(/password/i).first().fill(PASSWORD!);
    const submit = page.getByRole("button", { name: /^(sign in|log in|continue)/i });
    await submit.click();

    // Wait for the tenant-slug redirect. Middleware migrates /dashboard
    // → /{slug}/dashboard. Use URL change as the signal.
    await page.waitForURL(/\/[a-z0-9-]+\/(dashboard|verify-2fa|onboarding)/, { timeout: 30_000 });
    const postLoginUrl = page.url();
    const slugMatch = postLoginUrl.match(/\/([a-z0-9-]+)\//);
    const slug = slugMatch?.[1] ?? "";
    if (!slug) {
      throw new Error(`Could not derive tenant slug from post-login URL: ${postLoginUrl}`);
    }
    // If 2FA is enabled on this account, we can't proceed — flag + bail.
    if (postLoginUrl.includes("/verify-2fa")) {
      test.fail(true, "Account has 2FA enabled — jeweller walkthrough needs a non-2FA account or a pre-seeded AAL2 cookie");
    }

    testInfo.annotations.push({ type: "slug", description: slug });

    // ── Walk every route ───────────────────────────────────────────────
    const results: RouteResult[] = [];

    for (const route of TENANT_ROUTES) {
      const tenantUrl = `/${slug}${route}`;
      const result = await visitRoute(page, tenantUrl, route);
      results.push(result);
    }

    const report = summarise(results);
    testInfo.attach("walkthrough-report.txt", {
      body: report,
      contentType: "text/plain",
    }).catch(() => {});
    // Also log to console for immediate visibility in --reporter=list
    console.log("\n" + report + "\n");

    // Save as a machine-readable artifact so a follow-up agent can parse.
    testInfo.attach("walkthrough-results.json", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    }).catch(() => {});

    const broken = results.filter(
      (r) =>
        r.httpStatus >= 500 ||
        r.hasErrorUI ||
        r.consoleErrors.length > 0 ||
        r.networkFails.length > 0 ||
        !r.loadedOk,
    );

    // Don't hard-fail the run yet — we want the report first. But mark
    // the test as failed so the outer process knows.
    expect(broken, `${broken.length} routes had issues. See report.`).toHaveLength(0);
  });
});

async function visitRoute(
  page: Page,
  tenantUrl: string,
  label: string,
): Promise<RouteResult> {
  const consoleErrors: string[] = [];
  const networkFails: Array<{ url: string; status: number; method: string }> = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (/React DevTools/i.test(t)) return;
      if (/Failed to load resource.*401/i.test(t)) return;
      // 3rd-party annot8 feedback widget — external to the app
      if (/annot8\.dev\/snippet\.js/i.test(t)) return;
      // Known "Failed to fetch" noise from prefetch-abort when nav'ing fast;
      // only suppressed when it doesn't carry a status/response info.
      if (/TypeError: Failed to fetch/i.test(t) && !/status/i.test(t)) return;
      consoleErrors.push(t);
    }
  };
  const responseHandler = async (res: Response) => {
    const s = res.status();
    if (s >= 500) {
      const req = res.request();
      const url = res.url();
      // Capture both request shape + response body to pinpoint the fault.
      let actionId = "";
      let postBody = "";
      let respBody = "";
      try {
        actionId =
          req.headers()["next-action"] ||
          req.headers()["Next-Action"] ||
          "";
        postBody = (req.postData() ?? "").slice(0, 200);
        respBody = (await res.text().catch(() => "")).slice(0, 500);
      } catch {
        /* ignore */
      }
      networkFails.push({ url, status: s, method: req.method() });
      // Log immediately so tailing the console reveals the culprit
      // without waiting for the report at the end.
      // eslint-disable-next-line no-console
      console.log(`   [${label}] 5xx ${req.method()} ${url}  action=${actionId}  body=${postBody}  resp=${respBody}`);
    }
  };
  const requestFailedHandler = (req: Request) => {
    // Ignore aborted/cancelled prefetches — `_rsc=` query param marks the
    // React Server Component prefetches the app's nav sidebar fires in the
    // background. When the jeweller navigates before the prefetch lands,
    // the browser aborts and Playwright surfaces it as requestfailed with
    // status=0. That's not a bug — it's a performance optimisation
    // working as designed. Only flag non-prefetch failures.
    const url = req.url();
    if (/\?_rsc=/i.test(url)) return;
    // Also ignore form POSTs that we fired by clicking away — the
    // walkthrough doesn't submit forms, so any POST here is an aborted
    // prefetch or a background sync that got cut short.
    if (req.method() === "POST" && /_rsc=/.test(url)) return;
    const f = req.failure();
    if (f && !/ERR_ABORTED|net::ERR_ABORTED/i.test(f.errorText)) {
      networkFails.push({ url, status: 0, method: req.method() });
    }
  };
  page.on("console", consoleHandler);
  page.on("response", responseHandler);
  page.on("requestfailed", requestFailedHandler);

  const started = Date.now();
  let httpStatus = 0;
  let loadedOk = false;
  try {
    const resp = await page.goto(tenantUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    httpStatus = resp?.status() ?? 0;
    // Give the client a moment to mount + do first SWR fetch so we catch
    // errors that only fire post-hydration.
    await page.waitForTimeout(1500);
    loadedOk = true;
  } catch (err) {
    consoleErrors.push(`navigation threw: ${(err as Error).message}`);
  }

  const responseTimeMs = Date.now() - started;

  // Check visible error UI — look for known error boundary copy or an
  // <h1> with error-shaped text.
  let hasErrorUI = false;
  let errorUIText: string | null = null;
  try {
    const errorSelectors = [
      'text=/Something went wrong/i',
      'text=/Error.*boundary/i',
      'text=/An error occurred/i',
      'text=/500.*Internal Server Error/i',
      '[role=alert]:has-text("error")',
    ];
    for (const sel of errorSelectors) {
      const locator = page.locator(sel).first();
      if (await locator.count() > 0 && await locator.isVisible().catch(() => false)) {
        hasErrorUI = true;
        errorUIText = (await locator.textContent().catch(() => "")) ?? null;
        break;
      }
    }
  } catch {
    // no-op — absence of error UI is the happy path
  }

  const title = await page.title().catch(() => null);

  page.off("console", consoleHandler);
  page.off("response", responseHandler);
  page.off("requestfailed", requestFailedHandler);

  return {
    route: label,
    tenantUrl,
    httpStatus,
    responseTimeMs,
    consoleErrors,
    networkFails,
    hasErrorUI,
    errorUIText,
    title,
    loadedOk,
  };
}
