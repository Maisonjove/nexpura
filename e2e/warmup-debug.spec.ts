import { test } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

test('verify warmup script fires', async ({ browser }) => {
  test.setTimeout(2 * 60 * 1000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const origin = new URL(BASE).origin;
  const rscReqs: Array<{ t: number; url: string; origin: string }> = [];
  let navStart = 0;
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(origin)) return;
    const headers = req.headers();
    if (!('rsc' in headers)) return;
    rscReqs.push({ t: Date.now() - navStart, url: url.replace(origin, ''), origin: 'unknown' });
  });

  await ctx.clearCookies();

  // login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });

  // now we should be on /test/dashboard. Reload fresh to measure inline script.
  navStart = Date.now();
  await page.goto(`${BASE}/test/dashboard`, { waitUntil: 'domcontentloaded' });

  // wait a bit for inline script + initial fetches
  await page.waitForTimeout(3000);

  const probe = await page.evaluate(() => {
    const marks = performance.getEntriesByType('mark').map((m) => ({ name: m.name, t: Math.round(m.startTime) }));
    type W = { __nxWarmupT?: number; __nxWarmupFired?: number };
    const w = window as unknown as W;
    return {
      marks,
      nxWarmupT: w.__nxWarmupT ?? null,
      nxWarmupFired: w.__nxWarmupFired ?? null,
      currentURL: location.href,
      pathname: location.pathname,
    };
  });

  console.log('\n===== WARMUP DEBUG =====');
  console.log('current URL:', probe.currentURL);
  console.log('pathname:', probe.pathname);
  console.log('window.__nxWarmupFired:', probe.nxWarmupFired);
  console.log('window.__nxWarmupT:', probe.nxWarmupT);
  console.log('all marks:', JSON.stringify(probe.marks, null, 2));
  console.log(`rsc fetches fired in first 3s post-reload:`);
  for (const r of rscReqs) {
    console.log(`  t=${r.t}ms ${r.url}`);
  }
  console.log('========================\n');

  await ctx.close();
});
