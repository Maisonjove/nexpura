import { test, expect, Page } from '@playwright/test';

/**
 * Hard-nav proof pass for the (app)/layout shell split.
 *
 * Metrics captured per route:
 *   - firstPaint       — browser's first-paint entry (PerformanceObserver)
 *   - firstContentful  — first Contentful Paint (shell visible)
 *   - firstMeaningful  — when the route-specific h1/primary selector is visible
 *   - full             — when networkIdle OR the real data selector is visible
 *
 * Each route measured in 4 modes:
 *   - cold hard-nav     — clearCookies + login + goto(URL)
 *   - warm hard-nav     — same tab, already authed, hit the URL again
 *   - hard refresh      — reload() on the route
 *   - fresh browser     — new context (simulates fresh browser cold)
 *
 * Run with:
 *   BASE_URL=https://nexpura.com npx playwright test e2e/shell-split-timing.spec.ts --project chromium --reporter list --workers 1
 */

const BASE = process.env.BASE_URL ?? 'https://nexpura.com';
const EMAIL = process.env.TEST_EMAIL ?? 'Joeygermani11@icloud.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test123456';
const LABEL = process.env.RUN_LABEL ?? 'run';

type Sample = {
  route: string;
  mode: string;
  firstPaint: number | null;
  firstContentful: number | null;
  firstMeaningful: number | null;
  full: number | null;
};

const ROUTES: Array<{
  name: string;
  path: string;
  // selector that represents the static shell (should paint fast with shell-split)
  shellSelector: string;
  // selector that represents the meaningful primary content (h1 is always in shell now)
  meaningfulSelector: string;
  // selector that represents full real data visible (replaces the Suspense fallback)
  fullSelector: string;
}> = [
  {
    name: 'dashboard',
    path: '/dashboard',
    shellSelector: 'text=Loading',  // skeleton present
    meaningfulSelector: 'main h1, main h2, [class*=welcome]',
    fullSelector: '[class*=stat], [data-stat]',
  },
  {
    name: 'repairs',
    path: '/repairs',
    shellSelector: 'main h1:has-text("Repairs")',
    meaningfulSelector: 'main h1:has-text("Repairs")',
    fullSelector: 'main table, main [role=row], main .divide-y',
  },
  {
    name: 'bespoke',
    path: '/bespoke',
    shellSelector: 'main h1:has-text("Bespoke")',
    meaningfulSelector: 'main h1:has-text("Bespoke")',
    fullSelector: 'main table, main [role=row], main .divide-y',
  },
];

async function installPerfProbe(page: Page) {
  await page.addInitScript(() => {
    (window as any).__perf = { fp: null, fcp: null, marks: {} };
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-paint') (window as any).__perf.fp = entry.startTime;
          if (entry.name === 'first-contentful-paint') (window as any).__perf.fcp = entry.startTime;
        }
      });
      po.observe({ type: 'paint', buffered: true });
    } catch {}
  });
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
}

async function measure(
  page: Page,
  route: typeof ROUTES[number],
  mode: string,
): Promise<Sample> {
  // reset perf marks for this nav
  await page.evaluate(() => {
    (window as any).__perf = { fp: null, fcp: null };
  });

  const navStart = Date.now();
  if (mode === 'hard-refresh') {
    await page.reload({ waitUntil: 'commit', timeout: 60000 });
  } else {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'commit', timeout: 60000 });
  }

  // firstMeaningful: the route h1 is in the static shell now → should paint fast
  let firstMeaningful: number | null = null;
  try {
    await page.locator(route.meaningfulSelector).first().waitFor({ state: 'visible', timeout: 30000 });
    firstMeaningful = Date.now() - navStart;
  } catch {}

  // full: real data replaces Suspense fallback
  let full: number | null = null;
  try {
    await page.locator(route.fullSelector).first().waitFor({ state: 'visible', timeout: 30000 });
    full = Date.now() - navStart;
  } catch {}

  // let any remaining streaming complete so networkIdle is accurate
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  const perf = await page.evaluate(() => (window as any).__perf);

  return {
    route: route.name,
    mode,
    firstPaint: perf?.fp ? Math.round(perf.fp) : null,
    firstContentful: perf?.fcp ? Math.round(perf.fcp) : null,
    firstMeaningful,
    full,
  };
}

test.describe('shell-split hard-nav timing', () => {
  test.setTimeout(15 * 60 * 1000);

  test(`[${LABEL}] hard-nav matrix`, async ({ browser }) => {
    const results: Sample[] = [];

    // Single persistent context for cold/warm/refresh
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await installPerfProbe(page);
    await ctx.clearCookies();
    await login(page);

    for (const route of ROUTES) {
      // cold: clearCookies + re-login happens in fresh-browser mode below.
      // Here the session is warm (just logged in), so this is warm hard-nav.
      results.push(await measure(page, route, 'warm-hard-nav'));
      // same route again — should be router-cache-warm OR browser-cache-warm
      results.push(await measure(page, route, 'repeat-hard-nav'));
      // reload
      results.push(await measure(page, route, 'hard-refresh'));
    }

    await ctx.close();

    // Fresh-browser cold: new context, clear cookies, login fresh, goto each route
    for (const route of ROUTES) {
      const freshCtx = await browser.newContext();
      const freshPage = await freshCtx.newPage();
      await installPerfProbe(freshPage);
      await freshCtx.clearCookies();
      await login(freshPage);
      results.push(await measure(freshPage, route, 'fresh-browser-cold'));
      await freshCtx.close();
    }

    // Emit as a single structured block for easy diff
    console.log('\n===== SHELL-SPLIT TIMING RESULTS =====');
    console.log(JSON.stringify({ label: LABEL, base: BASE, results }, null, 2));
    console.log('======================================\n');

    // Also emit a human-readable table
    console.log('route              mode                 FP    FCP   meaningful   full');
    for (const r of results) {
      const line =
        r.route.padEnd(18) +
        r.mode.padEnd(21) +
        String(r.firstPaint ?? '-').padStart(5) + ' ' +
        String(r.firstContentful ?? '-').padStart(5) + ' ' +
        String(r.firstMeaningful ?? '-').padStart(12) + ' ' +
        String(r.full ?? '-').padStart(6);
      console.log(line);
    }

    expect(results.length).toBeGreaterThan(0);
  });
});
