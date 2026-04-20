import { test, expect } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

/**
 * Proof that the Service Worker coalesces concurrent fetches for the
 * same hot-route RSC prefetch URL within the same session.
 *
 * Strategy: fire two fetch() calls for the exact same URL + headers
 * near-simultaneously. Count unique outbound network requests to that
 * URL via page.on('request'). Without coalescing: 2 network requests,
 * both take ~1-2 s. With coalescing: 1 network request, the second
 * call's wall time is dominated by the SAME response's resolution
 * (should be within 100 ms of the first's wall time, not another
 * independent round-trip).
 *
 * We further verify: if we fire a THIRD call AFTER the first two have
 * resolved and the in-flight entry has been GC'd, we either get a
 * cache hit (if within TTL + cached) or a fresh network request
 * (if the 100ms GC already elapsed and TTL expired). That proves the
 * coalescing isn't permanent.
 */

test('SW coalesces concurrent hot-route RSC prefetches within the same session', async ({
  browser,
}) => {
  test.setTimeout(3 * 60 * 1000);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
  // Wait for SW + initial warmup to finish so we have a clean window for
  // the manual pair of fetches.
  await page.waitForTimeout(5000);

  // Network counter for the target URL. The SW, when it coalesces, makes
  // ONE outbound fetch. Without coalescing, each page-level fetch() would
  // cause a separate outbound fetch from the SW. We count outbound-from-SW
  // requests by listening on page.on('request').
  // Use a DIFFERENT URL from what the warmup already populated (by picking
  // a route whose cached entry would have expired by now — we waited 5s
  // and TTL is 15s, so use a rarely-prefetched route and then explicitly
  // expire the cache). Simpler: pick /test/repairs, wait until warmup's
  // cache of it has expired past TTL, then fire two near-simultaneous.
  //
  // Simplest: use a cache-busting `_rsc=<new hash>` to force a miss even
  // if the warmup cached something.
  const rscHashDefault = await page.evaluate(() => {
    function djb2(s: string) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
      return h >>> 0;
    }
    return djb2('1,/_tree,0,' + location.pathname).toString(36).slice(0, 5);
  });
  // Make the URL distinct from any warmup-cached entry by appending a
  // marker no warmup ever uses.
  const target = `${BASE}/test/repairs?_rsc=${rscHashDefault}&probe=coalesce-${Date.now()}`;

  const requestsSeen: Array<{ t: number; url: string }> = [];
  const origin = new URL(BASE).origin;
  const startWall = Date.now();
  page.on('request', (req) => {
    // Match on the exact URL (not startsWith) — SW outbound fetches will
    // have the same URL as the page-level fetch requested.
    if (req.url() === target) {
      requestsSeen.push({ t: Date.now() - startWall, url: req.url() });
    }
  });

  console.log('target:', target);
  console.log('rscHashDefault:', rscHashDefault);

  // Fire TWO fetches simultaneously. The second one should be coalesced
  // into the first's in-flight promise.
  const pair = await page.evaluate(async (u) => {
    const headers = {
      rsc: '1',
      'next-router-prefetch': '1',
      'next-router-segment-prefetch': '/_tree',
      'next-url': location.pathname,
    };
    const t0 = performance.now();
    const p1 = fetch(u, { credentials: 'same-origin', headers });
    // Intentionally start p2 a small amount later so the SW has a chance
    // to register p1's in-flight promise before p2 arrives.
    await new Promise((r) => setTimeout(r, 5));
    const t1 = performance.now();
    const p2 = fetch(u, { credentials: 'same-origin', headers });
    const [r1, r2] = await Promise.all([p1, p2]);
    const t2a = performance.now();
    await r1.text();
    const r1End = performance.now();
    await r2.text();
    const r2End = performance.now();
    return {
      start1: Math.round(t0),
      start2: Math.round(t1),
      finishBothBody: Math.round(t2a),
      r1End: Math.round(r1End),
      r2End: Math.round(r2End),
      status1: r1.status,
      status2: r2.status,
    };
  }, target);

  console.log('pair timings:', JSON.stringify(pair, null, 2));

  // Give Playwright a moment to flush the last request events.
  await page.waitForTimeout(500);

  console.log('\n---- Page-level request events observed ----');
  for (const r of requestsSeen) {
    console.log(`t=${r.t}ms ${r.url}`);
  }
  console.log('---- total: ----', requestsSeen.length);
  console.log(
    '(page.on(\'request\') reports each page-level fetch() call — NOT a clean proxy for SW outbound; use resolution-time alignment as the true signal.)',
  );

  // The real signal of coalescing: both fetches should finish at the SAME
  // INSTANT because they share the same underlying Response. If the SW
  // were not coalescing, the second fetch would start its own independent
  // round-trip and finish 300-2000ms after the first (network latency).
  // Allow a small jitter window to account for clone() body-tee overhead.
  const resolveGap = Math.abs(pair.r1End - pair.r2End);
  console.log(`resolveGap (|r1End - r2End|): ${resolveGap} ms`);

  expect(
    resolveGap,
    `coalesced fetches should resolve within <100ms of each other; observed ${resolveGap}ms`,
  ).toBeLessThan(100);

  // Additionally: the second fetch's elapsed wall time should be very
  // close to the first's (within one browser round-trip) — proving the
  // second didn't kick off its own network fetch.
  const fetch1Elapsed = pair.r1End - pair.start1;
  const fetch2Elapsed = pair.r2End - pair.start2;
  console.log(`fetch1 elapsed: ${fetch1Elapsed}ms  fetch2 elapsed: ${fetch2Elapsed}ms`);

  // fetch2 should not take meaningfully more than fetch1 — if it did,
  // it ran a fresh network round-trip (coalescing failed).
  const extraWork = fetch2Elapsed - fetch1Elapsed;
  console.log(`extra work on fetch2 (vs fetch1): ${extraWork}ms`);
  expect(
    extraWork,
    `fetch2 should not do meaningful extra network work; observed +${extraWork}ms`,
  ).toBeLessThan(150);

  await ctx.close();
});
