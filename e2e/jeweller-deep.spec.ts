/**
 * Jeweller-persona deep walkthrough — Phase 2.
 *
 * Phase 1 (jeweller-walkthrough.spec.ts) covered the 38 top-level
 * tenant routes. This spec extends coverage to ~50 sub-routes
 * (/customers/new, /settings/team, /reports/customers, etc.) AND to
 * detail pages (/customers/[id], /repairs/[id], /invoices/[id], etc.)
 * — finds a real ID by walking the list page first, then visits the
 * detail. Same single-test aggregator + report shape as Phase 1.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   pnpm exec playwright test e2e/jeweller-deep.spec.ts --reporter=line
 */

import { expect, test, type ConsoleMessage, type Page, type Request, type Response } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://nexpura-delta.vercel.app";
const EMAIL = process.env.NEXPURA_TEST_EMAIL;
const PASSWORD = process.env.NEXPURA_TEST_PASSWORD;

// Static sub-routes — no [id] placeholders. Visit directly.
const SUB_ROUTES = [
  "/appraisals/new",
  "/bespoke/new",
  "/communications/new",
  "/customers/automation",
  "/customers/campaigns",
  "/customers/new",
  "/expenses/new",
  "/integrations/google-calendar",
  "/inventory/new",
  "/inventory/receive",
  "/inventory/transfers",
  "/invoices/new",
  "/marketing/analytics",
  "/marketing/automations",
  "/marketing/bulk-email",
  "/marketing/bulk-sms",
  "/marketing/campaigns",
  "/marketing/campaigns/new",
  "/marketing/segments",
  "/marketing/templates",
  "/marketing/whatsapp-campaigns",
  "/marketing/whatsapp-campaigns/new",
  "/memo/new",
  "/migration/assisted",
  "/migration/logs",
  "/migration/new",
  "/passports/new",
  "/quotes/new",
  "/repairs/new",
  "/reports/customers",
  "/reports/expenses",
  "/reports/stock",
  "/reports/suppliers",
  "/sales/new",
  "/settings/activity",
  "/settings/billing",
  "/settings/documents",
  "/settings/email",
  "/settings/email-domain",
  "/settings/general",
  "/settings/import",
  "/settings/integrations",
  "/settings/locations",
  "/settings/notifications",
  "/settings/numbering",
  "/settings/payments",
  "/settings/printers",
  "/settings/printing",
  "/settings/reminders",
  "/settings/reports",
  "/settings/roles",
  "/settings/sync",
  "/settings/tags",
  "/settings/task-templates",
  "/settings/team",
  "/settings/team/permissions",
  "/settings/two-factor",
  "/suppliers/new",
  "/tasks/new",
  "/tasks/workshop",
  "/website/builder",
  "/website/connect",
  "/website/import",
  "/workshop/calendar",
];

// For each list page, scrape the first detail-link href and visit it.
// This walks the real entity pages (with real IDs) without mutating data.
const DETAIL_PROBES: Array<{ list: string; detailPattern: RegExp; label: string }> = [
  { list: "/customers", detailPattern: /\/customers\/[a-f0-9-]{36}(\b|$)/, label: "/customers/[id]" },
  { list: "/repairs", detailPattern: /\/repairs\/[a-f0-9-]{36}(\b|$)/, label: "/repairs/[id]" },
  { list: "/bespoke", detailPattern: /\/bespoke\/[a-f0-9-]{36}(\b|$)/, label: "/bespoke/[id]" },
  { list: "/invoices", detailPattern: /\/invoices\/[a-f0-9-]{36}(\b|$)/, label: "/invoices/[id]" },
  { list: "/quotes", detailPattern: /\/quotes\/[a-f0-9-]{36}(\b|$)/, label: "/quotes/[id]" },
  { list: "/sales", detailPattern: /\/sales\/[a-f0-9-]{36}(\b|$)/, label: "/sales/[id]" },
  { list: "/inventory", detailPattern: /\/inventory\/[a-f0-9-]{36}(\b|$)/, label: "/inventory/[id]" },
  { list: "/suppliers", detailPattern: /\/suppliers\/[a-f0-9-]{36}(\b|$)/, label: "/suppliers/[id]" },
  { list: "/expenses", detailPattern: /\/expenses\/[a-f0-9-]{36}(\b|$)/, label: "/expenses/[id]" },
  { list: "/passports", detailPattern: /\/passports\/[a-f0-9-]{36}(\b|$)/, label: "/passports/[id]" },
  { list: "/appraisals", detailPattern: /\/appraisals\/[a-f0-9-]{36}(\b|$)/, label: "/appraisals/[id]" },
  { list: "/laybys", detailPattern: /\/laybys\/[a-f0-9-]{36}(\b|$)/, label: "/laybys/[id]" },
  { list: "/tasks", detailPattern: /\/tasks\/[a-f0-9-]{36}(\b|$)/, label: "/tasks/[id]" },
  { list: "/stocktakes", detailPattern: /\/stocktakes\/[a-f0-9-]{36}(\b|$)/, label: "/stocktakes/[id]" },
  { list: "/vouchers", detailPattern: /\/vouchers\/[a-f0-9-]{36}(\b|$)/, label: "/vouchers/[id]" },
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
      lines.push(`✅ ${r.route.padEnd(38)} ${r.httpStatus} ${r.responseTimeMs}ms  "${(r.title ?? "").slice(0, 32)}"`);
    } else {
      lines.push(`❌ ${r.route.padEnd(38)} ${r.httpStatus} ${r.responseTimeMs}ms  ${issues.join(" | ")}`);
      for (const err of r.consoleErrors.slice(0, 2)) lines.push(`   console: ${err.slice(0, 180)}`);
      for (const nf of r.networkFails.slice(0, 2)) lines.push(`   network: ${nf.method} ${nf.url} -> ${nf.status}`);
    }
  }
  lines.push("");
  lines.push(`Summary: ${okCount}/${results.length} routes clean`);
  return lines.join("\n");
}

test.describe("Jeweller deep walkthrough", () => {
  test.skip(!EMAIL || !PASSWORD, "NEXPURA_TEST_EMAIL and NEXPURA_TEST_PASSWORD must be set");
  test.setTimeout(30 * 60 * 1000); // 30 min cap

  test("sub-routes + detail pages load without errors", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/email/i).first().fill(EMAIL!);
    await page.getByLabel(/password/i).first().fill(PASSWORD!);
    await page.getByRole("button", { name: /^(sign in|log in|continue)/i }).click();
    await page.waitForURL(/\/[a-z0-9-]+\/(dashboard|verify-2fa|onboarding)/, { timeout: 30_000 });
    const slug = (page.url().match(/\/([a-z0-9-]+)\//) ?? [])[1] ?? "";
    if (!slug || page.url().includes("/verify-2fa")) {
      throw new Error(`Cannot proceed — slug=${slug}, url=${page.url()}`);
    }
    testInfo.annotations.push({ type: "slug", description: slug });

    const results: RouteResult[] = [];

    // ── 1. Static sub-routes ───────────────────────────────────────────
    for (const route of SUB_ROUTES) {
      results.push(await visitRoute(page, `/${slug}${route}`, route));
    }

    // ── 2. Detail pages — find a real ID per type, visit it ────────────
    for (const probe of DETAIL_PROBES) {
      const listUrl = `/${slug}${probe.list}`;
      try {
        await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(800);
        // Find the first detail-link href.
        const handles = await page.locator("a[href]").elementHandles();
        let detailUrl: string | null = null;
        for (const h of handles) {
          const href = await h.getAttribute("href");
          if (href && probe.detailPattern.test(href)) {
            detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
            break;
          }
        }
        if (!detailUrl) {
          results.push({
            route: probe.label,
            tenantUrl: "(no entity found in list)",
            httpStatus: 0,
            responseTimeMs: 0,
            consoleErrors: [],
            networkFails: [],
            hasErrorUI: false,
            errorUIText: null,
            title: "(empty list — skipped)",
            loadedOk: true,
          });
          continue;
        }
        results.push(await visitRoute(page, detailUrl, probe.label));
      } catch (err) {
        results.push({
          route: probe.label,
          tenantUrl: listUrl,
          httpStatus: 0,
          responseTimeMs: 0,
          consoleErrors: [`probe failed: ${(err as Error).message}`],
          networkFails: [],
          hasErrorUI: false,
          errorUIText: null,
          title: null,
          loadedOk: false,
        });
      }
    }

    const report = summarise(results);
    testInfo.attach("deep-walkthrough-report.txt", { body: report, contentType: "text/plain" }).catch(() => {});
    console.log("\n" + report + "\n");
    testInfo.attach("deep-walkthrough-results.json", {
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
    expect(broken, `${broken.length} routes had issues. See report.`).toHaveLength(0);
  });
});

async function visitRoute(page: Page, fullUrl: string, label: string): Promise<RouteResult> {
  const consoleErrors: string[] = [];
  const networkFails: Array<{ url: string; status: number; method: string }> = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (/React DevTools/i.test(t)) return;
    if (/Failed to load resource.*401/i.test(t)) return;
    if (/annot8\.dev\/snippet\.js/i.test(t)) return;
    if (/TypeError: Failed to fetch/i.test(t) && !/status/i.test(t)) return;
    consoleErrors.push(t);
  };
  const responseHandler = (res: Response) => {
    const s = res.status();
    if (s >= 500) {
      networkFails.push({ url: res.url(), status: s, method: res.request().method() });
    } else if (s >= 400) {
      // 4xxs are not necessarily failures — auth probes, "no factor
      // enrolled" 400s, expected 404s for optional resources etc. all
      // show up. Filter out the ones we've already classified as
      // expected so the report stays focused on actionable issues.
      const url = res.url();
      if (s === 401 && /\/api\/auth\/(sessions|user|getUser)/i.test(url)) return;
      if (s === 401) return; // bare 401 mid-redirect — still skip
      if (s === 404 && /favicon\.ico|\.map$/i.test(url)) return;
      consoleErrors.push(`[${s}] ${res.request().method()} ${url}`);
    }
  };
  const requestFailedHandler = (req: Request) => {
    const url = req.url();
    if (/\?_rsc=/i.test(url)) return;
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
    const resp = await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    httpStatus = resp?.status() ?? 0;
    await page.waitForTimeout(1500);
    loadedOk = true;
  } catch (err) {
    consoleErrors.push(`navigation threw: ${(err as Error).message}`);
  }
  const responseTimeMs = Date.now() - started;

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
      if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
        hasErrorUI = true;
        errorUIText = (await locator.textContent().catch(() => "")) ?? null;
        break;
      }
    }
  } catch { /* no-op */ }

  const title = await page.title().catch(() => null);

  page.off("console", consoleHandler);
  page.off("response", responseHandler);
  page.off("requestfailed", requestFailedHandler);

  return {
    route: label,
    tenantUrl: fullUrl,
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
