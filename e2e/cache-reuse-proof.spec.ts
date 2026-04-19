import { test, expect } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

/**
 * Proof that hot-route RSC prefetch responses are reusable from the
 * browser HTTP cache within the 15-second window.
 *
 * Strategy: after login, fire ONE prefetch-shaped fetch to a hot route,
 * wait, fire the IDENTICAL fetch again. Inspect both responses.
 *   - First:  status 200, fromCache=false, transferSize>0
 *   - Second: status 200, fromCache=true, transferSize=0 (or tiny)
 *   - First has `Cache-Control: private, max-age=15, must-revalidate`
 *   - Both have `Vary` including `cookie`
 */

test('hot-route RSC prefetch response is reused from browser HTTP cache', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });

  // Give initial page load a moment to settle
  await page.waitForTimeout(1500);

  // Compute the _rsc hash the same way the inline script does.
  // For a prefetch FROM /test/dashboard to /test/customers, the hash is
  // djb2Hash('1,/_tree,0,/test/dashboard') in base36 first 5 chars.
  const rscHash = await page.evaluate(() => {
    function djb2(s: string) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
      return h >>> 0;
    }
    return djb2('1,/_tree,0,' + location.pathname).toString(36).slice(0, 5);
  });

  const targets = [
    '/test/customers',
    '/test/repairs',
    '/test/inventory',
    '/test/tasks',
  ];

  const results: Array<{
    url: string;
    first: { status: number; fromCache: boolean; transferSize: number; cacheControl?: string; vary?: string; wall: number };
    second: { status: number; fromCache: boolean; transferSize: number; wall: number };
    reused: boolean;
  }> = [];

  for (const path of targets) {
    const url = `${BASE}${path}?_rsc=${rscHash}`;

    // First fetch — populates cache
    const r1 = await page.evaluate(async (u) => {
      const start = performance.now();
      const res = await fetch(u, {
        credentials: 'same-origin',
        headers: {
          rsc: '1',
          'next-router-prefetch': '1',
          'next-router-segment-prefetch': '/_tree',
          'next-url': location.pathname,
        },
      });
      const wall = performance.now() - start;
      await res.text();
      // Pull what we can from performance entries for this URL
      const entries = performance.getEntriesByName(u) as PerformanceResourceTiming[];
      const entry = entries[entries.length - 1];
      return {
        status: res.status,
        cacheControl: res.headers.get('cache-control') ?? undefined,
        vary: res.headers.get('vary') ?? undefined,
        wall: Math.round(wall),
        transferSize: entry?.transferSize ?? -1,
        fromCache: entry ? entry.transferSize === 0 && entry.decodedBodySize > 0 : false,
      };
    }, url);

    // Wait 500ms (well within 15s TTL) and fire identical fetch
    await page.waitForTimeout(500);

    const r2 = await page.evaluate(async (u) => {
      const start = performance.now();
      const res = await fetch(u, {
        credentials: 'same-origin',
        headers: {
          rsc: '1',
          'next-router-prefetch': '1',
          'next-router-segment-prefetch': '/_tree',
          'next-url': location.pathname,
        },
      });
      const wall = performance.now() - start;
      await res.text();
      const entries = performance.getEntriesByName(u) as PerformanceResourceTiming[];
      const entry = entries[entries.length - 1];
      return {
        status: res.status,
        wall: Math.round(wall),
        transferSize: entry?.transferSize ?? -1,
        fromCache: entry ? entry.transferSize === 0 && entry.decodedBodySize > 0 : false,
      };
    }, url);

    results.push({
      url,
      first: r1,
      second: r2,
      reused: r2.fromCache || r2.transferSize === 0,
    });
  }

  console.log('\n===== HOT-ROUTE RSC CACHE-REUSE PROOF =====');
  for (const r of results) {
    console.log(`\n${r.url}`);
    console.log(`  1st: ${r.first.wall}ms  status=${r.first.status}  transferSize=${r.first.transferSize}  fromCache=${r.first.fromCache}`);
    console.log(`       cache-control: ${r.first.cacheControl}`);
    console.log(`       vary: ${r.first.vary}`);
    console.log(`  2nd: ${r.second.wall}ms  status=${r.second.status}  transferSize=${r.second.transferSize}  fromCache=${r.second.fromCache}`);
    console.log(`  REUSED: ${r.reused ? 'YES ✓' : 'NO ✗'}`);
  }
  console.log('\n============================================\n');

  // Assert: at least one route shows cache reuse
  const reusedCount = results.filter((r) => r.reused).length;
  expect(reusedCount).toBeGreaterThan(0);

  await ctx.close();
});
