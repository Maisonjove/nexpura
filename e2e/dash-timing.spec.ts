import { test, Page } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

test('dashboard timing', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);

  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1000);
  });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  console.log('logged in');

  // Dashboard network timings
  const reqs: Array<{ method: string; url: string; status?: number; ms?: number; start: number; resourceType: string }> = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/nexpura\.com|supabase/i.test(u)) {
      reqs.push({ method: req.method(), url: u, start: Date.now(), resourceType: req.resourceType() });
    }
  });
  page.on('response', async (res) => {
    const rec = reqs.find(r => r.url === res.url() && r.status === undefined);
    if (rec) { rec.status = res.status(); rec.ms = Date.now() - rec.start; }
  });

  // Measure 3 loads: cold, warm1, warm2
  for (let i = 0; i < 3; i++) {
    const label = i === 0 ? 'cold (clear cache)' : `warm${i}`;
    if (i === 0) {
      // Try to bust the cache: log out/in-ish not feasible here, just hard nav
      await page.context().clearCookies();
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
      await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
      await page.locator('form button[type=submit]').first().click();
      await page.waitForURL(/dashboard/i, { timeout: 30000 });
    }
    const beforeLen = reqs.length;
    const t0 = Date.now();
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    const domReady = Date.now() - t0;
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const networkIdle = Date.now() - t0;
    console.log(`\n=== ${label} ===  domReady=${domReady}ms  networkIdle=${networkIdle}ms`);

    // Slowest requests for this load
    const these = reqs.slice(beforeLen);
    const sorted = [...these].sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0)).slice(0, 10);
    for (const r of sorted) {
      if (r.ms && r.ms > 200) console.log(`  ${r.ms}ms ${r.status ?? '?'} ${r.method} ${r.url.replace(BASE, '').slice(0, 100)}`);
    }
  }
});
