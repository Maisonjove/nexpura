import { test } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'https://nexpura.com';
const EMAIL = process.env.TEST_EMAIL ?? 'Joeygermani11@icloud.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test123456';
const LABEL = process.env.RUN_LABEL ?? 'run';

/**
 * Measure the full pre-hydration → hydration → prefetch → first-click race.
 *
 * Captures, relative to the post-login `goto(/dashboard)` navigation start:
 *   - firstPaint (browser perf entry)
 *   - firstContentfulPaint
 *   - nx_warmup_start          (inline script begins)
 *   - nx_warmup_fired_N        (inline script finished firing N fetches)
 *   - nx_routeprefetcher_mount (RoutePrefetcher useEffect fires)
 *   - nx_routeprefetcher_fire_hot (router.prefetch for hot tier)
 *
 * Then performs 8 hot first-clicks and measures click-to-h1-visible.
 */

type Sample = {
  label: string;
  route: string;
  firstPaint: number | null;
  firstContentful: number | null;
  nxWarmupFired: number | null;
  nxWarmupFiredCount: number | null;
  nxBootstrapMount: number | null;
  nxBootstrapFire: number | null;
  nxRPMount: number | null;
  nxRPFireHot: number | null;
  click: { target: string; href: string; ms: number } | null;
};

const HOT_CLICKS = [
  { target: 'customers',  linkText: /^All Customers$/ },
  { target: 'repairs',    linkText: /^Repairs$/ },
  { target: 'inventory',  linkText: /^All Items$/ },
  { target: 'tasks',      linkText: /^Tasks$/ },
  { target: 'invoices',   linkText: /^Invoices$/ },
  { target: 'bespoke',    linkText: /^Bespoke Jobs$/ },
  { target: 'workshop',   linkText: /^Workshop View$/ },
  { target: 'intake',     linkText: /^New Intake$/ },
];

async function installPerfProbe(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as { __perf: { fp: number | null; fcp: number | null } }).__perf = { fp: null, fcp: null };
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const w = window as unknown as { __perf: { fp: number | null; fcp: number | null } };
          if (entry.name === 'first-paint') w.__perf.fp = entry.startTime;
          if (entry.name === 'first-contentful-paint') w.__perf.fcp = entry.startTime;
        }
      });
      po.observe({ type: 'paint', buffered: true });
    } catch {}
  });
}

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
}

async function collectMarks(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const marks = performance.getEntriesByType('mark').reduce((acc: Record<string, number>, m) => {
      acc[m.name] = Math.round(m.startTime);
      return acc;
    }, {});
    type Perf = { fp: number | null; fcp: number | null };
    const perf = (window as unknown as { __perf?: Perf }).__perf;
    return {
      fp: perf?.fp ? Math.round(perf.fp) : null,
      fcp: perf?.fcp ? Math.round(perf.fcp) : null,
      marks,
    };
  });
}

test('first-click race timeline + click latency', async ({ browser }) => {
  test.setTimeout(15 * 60 * 1000);
  const samples: Sample[] = [];

  for (const click of HOT_CLICKS) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await installPerfProbe(page);
    await ctx.clearCookies();

    await login(page);
    // We're on /dashboard. Do not wait; measure the race.

    // Give it a brief moment for the inline script to fire & for the
    // shell to start streaming — but DO NOT wait for hydration. We're
    // simulating a user who clicks fast.
    await page.waitForTimeout(600);

    const pre = await collectMarks(page);

    const link = page.getByRole('link', { name: click.linkText }).first();
    // If link isn't in DOM/visible yet (dashboard still streaming), fall
    // back to a url-based click after the TopNav renders.
    let href: string | null = null;
    const visible = await link.isVisible().catch(() => false);
    const clickStart = Date.now();
    if (visible) {
      href = await link.getAttribute('href').catch(() => null);
      await link.click();
    } else {
      // TopNav inside a dropdown — not visible until hover. Hover the
      // parent trigger, then click.
      // For the measurement we don't want to add hover latency — just
      // force-navigate via page.goto to the tenant-prefixed URL derived
      // from the current pathname's slug.
      const currentPath = page.url().replace(BASE, '');
      const seg = currentPath.split('/')[1];
      const prefix = seg && !['login','signup','verify'].includes(seg) ? `/${seg}` : '';
      href = `${prefix}/${click.target === 'intake' ? 'intake' : click.target === 'customers' ? 'customers' : click.target === 'repairs' ? 'repairs' : click.target === 'inventory' ? 'inventory' : click.target === 'tasks' ? 'tasks' : click.target === 'invoices' ? 'invoices' : click.target === 'bespoke' ? 'bespoke' : click.target === 'workshop' ? 'workshop' : click.target}`;
      await page.goto(`${BASE}${href}`, { waitUntil: 'commit' });
    }
    // Wait for the destination page's primary content (h1 or tab strip)
    await page
      .locator('main h1, main [class*=tabs], main [role=tablist]')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .catch(() => {});
    const clickMs = Date.now() - clickStart;

    samples.push({
      label: LABEL,
      route: click.target,
      firstPaint: pre.fp,
      firstContentful: pre.fcp,
      nxWarmupFired: pre.marks['nx_warmup_start'] ?? null,
      nxWarmupFiredCount:
        Object.keys(pre.marks).filter((k) => k.startsWith('nx_warmup_fired_')).length > 0
          ? Number(
              Object.keys(pre.marks)
                .find((k) => k.startsWith('nx_warmup_fired_'))
                ?.replace('nx_warmup_fired_', ''),
            )
          : null,
      nxBootstrapMount: pre.marks['nx_bootstrap_mount'] ?? null,
      nxBootstrapFire: pre.marks['nx_bootstrap_fire'] ?? null,
      nxRPMount: pre.marks['nx_routeprefetcher_mount'] ?? null,
      nxRPFireHot: pre.marks['nx_routeprefetcher_fire_hot'] ?? null,
      click: { target: click.target, href: href ?? '?', ms: clickMs },
    });

    await ctx.close();
  }

  console.log('\n===== FIRST-CLICK RACE TIMELINE =====');
  console.log(JSON.stringify({ label: LABEL, base: BASE, samples }, null, 2));
  console.log('=====================================\n');

  console.log('route        FP    FCP   wu@   bootMnt@ bootFire@ RPmount@ RPfire@  clickMs  href');
  for (const s of samples) {
    const line =
      s.route.padEnd(12) +
      String(s.firstPaint ?? '-').padStart(5) + ' ' +
      String(s.firstContentful ?? '-').padStart(5) + ' ' +
      String(s.nxWarmupFired ?? '-').padStart(5) + ' ' +
      String(s.nxBootstrapMount ?? '-').padStart(8) + ' ' +
      String(s.nxBootstrapFire ?? '-').padStart(9) + ' ' +
      String(s.nxRPMount ?? '-').padStart(8) + ' ' +
      String(s.nxRPFireHot ?? '-').padStart(7) + ' ' +
      String(s.click?.ms ?? '-').padStart(8) + ' ' +
      (s.click?.href ?? '-');
    console.log(line);
  }
});
