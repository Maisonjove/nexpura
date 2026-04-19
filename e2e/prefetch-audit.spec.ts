import { test } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

/**
 * Capture the EXACT request shape that Next.js's router.prefetch fires
 * for our hot routes. We need to match this shape from a pre-hydration
 * inline script, otherwise the browser treats it as a different request
 * and the prefetch is wasted.
 *
 * Prints, for each prefetch request:
 *   - URL including query string (particularly _rsc=<hash>)
 *   - All request headers
 *   - Response Cache-Control + Vary
 *   - Timing relative to first HTML byte
 */
test('prefetch request-shape audit', async ({ browser }) => {
  test.setTimeout(4 * 60 * 1000);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const events: Array<{ t: number; kind: 'req' | 'res'; url: string; headers?: Record<string, string>; status?: number; cacheControl?: string; vary?: string }> = [];
  const origin = new URL(BASE).origin;
  let t0 = 0;

  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(origin)) return;
    // only interesting: RSC prefetches. These always include the `rsc` header
    // on Next.js 15+. Non-RSC asset fetches won't have it.
    const headers = req.headers();
    if (!('rsc' in headers)) return;
    events.push({ t: t0 ? Date.now() - t0 : 0, kind: 'req', url, headers });
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.startsWith(origin)) return;
    const req = res.request();
    const reqHeaders = req.headers();
    if (!('rsc' in reqHeaders)) return;
    const resHeaders = res.headers();
    events.push({
      t: t0 ? Date.now() - t0 : 0,
      kind: 'res',
      url,
      status: res.status(),
      cacheControl: resHeaders['cache-control'],
      vary: resHeaders['vary'],
    });
  });

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });

  t0 = Date.now();

  // now we're on /dashboard. wait for hydration + prefetcher + hot-tier fires
  // + warm-tier fires. 8 seconds is plenty.
  await page.waitForTimeout(8000);

  console.log('\n===== RSC prefetch request-shape audit =====');
  console.log(`captured ${events.length} events from t=0 (post-login) over 8s window`);
  console.log('----------------------------------------------------------------');
  const reqs = events.filter((e) => e.kind === 'req');
  for (const r of reqs) {
    const pathWithQuery = r.url.replace(origin, '');
    console.log(`\n[${String(r.t).padStart(4)}ms REQ] ${pathWithQuery}`);
    const h = r.headers ?? {};
    for (const key of ['rsc', 'next-router-prefetch', 'next-router-segment-prefetch', 'next-router-state-tree', 'next-url']) {
      if (key in h) console.log(`   ${key}: ${h[key]}`);
    }
  }
  console.log('\n---- responses ----');
  for (const r of events.filter((e) => e.kind === 'res')) {
    const pathWithQuery = r.url.replace(origin, '');
    console.log(`[${String(r.t).padStart(4)}ms RES ${r.status}] ${pathWithQuery}`);
    if (r.cacheControl) console.log(`   cache-control: ${r.cacheControl}`);
    if (r.vary) console.log(`   vary: ${r.vary}`);
  }
  console.log('===============================================\n');

  await ctx.close();
});
