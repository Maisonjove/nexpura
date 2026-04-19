import { test, expect } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

/**
 * Verify the SW's cookie-hash check refuses to serve a cached RSC
 * response across a cookie rotation. We don't have a second test user,
 * so we simulate a cookie change by:
 *   1. Log in → fill SW cache for /test/customers.
 *   2. Manually overwrite a Supabase auth cookie to a different value
 *      (what happens on session refresh or logout).
 *   3. Fire the same fetch — should NOT be served from cache (cookie
 *      hash mismatch), and should take round-trip time (full network
 *      fetch), not ~3 ms.
 */
test('SW cookie-hash guard refuses cross-cookie cache reuse', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const rscHash = await page.evaluate(() => {
    function djb2(s: string) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
      return h >>> 0;
    }
    return djb2('1,/_tree,0,' + location.pathname).toString(36).slice(0, 5);
  });
  const targetUrl = `${BASE}/test/customers?_rsc=${rscHash}`;

  // Populate the SW cache.
  const first = await page.evaluate(async (u) => {
    const t0 = performance.now();
    const res = await fetch(u, {
      credentials: 'same-origin',
      headers: {
        rsc: '1',
        'next-router-prefetch': '1',
        'next-router-segment-prefetch': '/_tree',
        'next-url': location.pathname,
      },
    });
    await res.text();
    return { wall: Math.round(performance.now() - t0), status: res.status };
  }, targetUrl);
  console.log('[seed] fetch:', first);

  // Confirm it's cached (same cookie).
  const secondSameCookie = await page.evaluate(async (u) => {
    const t0 = performance.now();
    const res = await fetch(u, {
      credentials: 'same-origin',
      headers: {
        rsc: '1',
        'next-router-prefetch': '1',
        'next-router-segment-prefetch': '/_tree',
        'next-url': location.pathname,
      },
    });
    await res.text();
    return { wall: Math.round(performance.now() - t0), status: res.status };
  }, targetUrl);
  console.log('[same-cookie] fetch:', secondSameCookie);
  expect(secondSameCookie.wall, 'same-cookie should be cache hit').toBeLessThan(200);

  // Now mutate a Supabase auth cookie to simulate a cookie rotation
  // (session refresh or logout/login as a different user).
  const beforeCookies = await ctx.cookies(BASE);
  const authCookie = beforeCookies.find((c) =>
    c.name.includes('sb-') && c.name.includes('auth-token'),
  );
  console.log('[cookie] target auth cookie:', authCookie?.name);
  expect(authCookie, 'should have a Supabase auth cookie to mutate').toBeTruthy();
  if (authCookie) {
    await ctx.addCookies([
      {
        ...authCookie,
        value: 'MUTATED_COOKIE_FOR_TEST_' + Date.now(),
      },
    ]);
  }

  // Read cookies as the browser sees them — BOTH via ctx AND via document.cookie
  // (which is the source the SW / fetch Cookie header derives from).
  const afterCookies = await ctx.cookies(BASE);
  const authAfter = afterCookies.find((c) => c.name === authCookie?.name);
  console.log('[cookie] after mutation (ctx):', authAfter?.name, '=', authAfter?.value?.slice(0, 40));
  const docCookieAfter = await page.evaluate(() => document.cookie);
  console.log('[cookie] document.cookie content (first 200 chars):', docCookieAfter.slice(0, 200));
  console.log('[cookie] contains MUTATED?', docCookieAfter.includes('MUTATED_COOKIE_FOR_TEST_'));

  // Fire the identical request. The Cookie header the browser sends now
  // has a different value (because of our mutation). The SW should compute
  // a different cookie hash and REFUSE to serve the cached entry → full
  // round-trip.
  const afterMutation = await page.evaluate(async (u) => {
    const t0 = performance.now();
    try {
      const res = await fetch(u, {
        credentials: 'same-origin',
        headers: {
          rsc: '1',
          'next-router-prefetch': '1',
          'next-router-segment-prefetch': '/_tree',
          'next-url': location.pathname,
        },
      });
      await res.text();
      return { wall: Math.round(performance.now() - t0), status: res.status };
    } catch (err) {
      return { wall: Math.round(performance.now() - t0), status: 0, err: String(err) };
    }
  }, targetUrl);
  console.log('[mutated-cookie] fetch:', afterMutation);

  // Expect the mutated-cookie fetch to NOT be served from cache. Either:
  // - it's a full round-trip (>300 ms typical on Sydney round-trip)
  // - or it throws/errors (network rejects the mutated token)
  expect(
    afterMutation.wall > 300 || afterMutation.status !== 200,
    `cross-cookie fetch should NOT be served from SW cache (observed ${afterMutation.wall} ms status=${afterMutation.status})`,
  ).toBeTruthy();

  await ctx.close();
});
