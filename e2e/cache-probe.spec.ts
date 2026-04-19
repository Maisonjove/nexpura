import { test } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

test('deep inspect cache layer for hot-route RSC', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
  await page.waitForTimeout(2000);

  // Disable service worker for this probe
  const probe = await page.evaluate(async () => {
    const swRegs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    const swActive = swRegs.length > 0;
    return { swActive, swScope: swRegs[0]?.scope ?? null };
  });
  console.log('SW active:', probe.swActive, 'scope:', probe.swScope);

  // Compute hash for prefetch from current pathname
  const rscHash = await page.evaluate(() => {
    function djb2(s: string) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
      return h >>> 0;
    }
    return djb2('1,/_tree,0,' + location.pathname).toString(36).slice(0, 5);
  });
  console.log('computed rsc hash:', rscHash);

  // Track all network requests to the target URL
  const target = `${BASE}/test/customers?_rsc=${rscHash}`;
  const net: Array<{ t: number; url: string; method: string; status?: number; cc?: string; vary?: string; fromSw?: boolean }> = [];
  const start = Date.now();
  page.on('request', (req) => {
    if (req.url() === target) {
      net.push({ t: Date.now() - start, url: req.url(), method: req.method() });
    }
  });
  page.on('response', (res) => {
    if (res.url() === target) {
      const rec = net.find((r) => r.url === res.url() && r.status === undefined);
      if (rec) {
        rec.status = res.status();
        rec.cc = res.headers()['cache-control'];
        rec.vary = res.headers()['vary'];
        rec.fromSw = res.fromServiceWorker();
      }
    }
  });

  console.log('\n---- Fetch #1 ----');
  const r1 = await page.evaluate(async (u) => {
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
    const body = await res.text();
    return {
      wall: Math.round(performance.now() - t0),
      status: res.status,
      cc: res.headers.get('cache-control'),
      vary: res.headers.get('vary'),
      bodyLen: body.length,
    };
  }, target);
  console.log(JSON.stringify(r1, null, 2));

  await page.waitForTimeout(800);

  console.log('\n---- Fetch #2 (should be cache-hit if caching works) ----');
  const r2 = await page.evaluate(async (u) => {
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
    const body = await res.text();
    return {
      wall: Math.round(performance.now() - t0),
      status: res.status,
      cc: res.headers.get('cache-control'),
      vary: res.headers.get('vary'),
      bodyLen: body.length,
    };
  }, target);
  console.log(JSON.stringify(r2, null, 2));

  console.log('\n---- Network events captured ----');
  for (const n of net) {
    console.log(`t=${n.t}ms ${n.method} ${n.url.split('?')[0]}?... status=${n.status} fromSW=${n.fromSw} cc=${n.cc} vary=${n.vary}`);
  }

  await ctx.close();
});
