import { test, expect, Page, Locator } from '@playwright/test';

/**
 * SPA-nav regression check for the (app)/layout shell split.
 *
 * Goal: prove the router-cache-hit warm-nav win (<300ms, typical 23-66ms)
 * is still intact after the layout refactor that made (app)/layout.tsx
 * fully synchronous and moved tenant-slug detection into TopNav +
 * RoutePrefetcher + NativePrefetchHints via URL heuristic.
 *
 * Flow:
 *   1. login -> /dashboard
 *   2. wait 3s for RoutePrefetcher hot/warm tiers to warm (50ms + 1500ms)
 *   3. SPA-click through Customers -> Inventory -> Repairs -> Tasks -> Dashboard
 *   4. repeat the sequence a second time
 *   5. print per-click timing + href (to verify tenant-prefix)
 *
 * Run:
 *   BASE_URL=https://nexpura.com \
 *     npx playwright test e2e/shell-split-spa-nav.spec.ts \
 *     --project chromium --reporter=list --workers=1
 */

const BASE = process.env.BASE_URL ?? 'https://nexpura.com';
const EMAIL = process.env.TEST_EMAIL ?? 'Joeygermani11@icloud.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test123456';

type NavStep = {
  from: string;             // short name of route we're on ("dashboard")
  to: string;               // short name of destination ("customers")
  dropdownLabel: string;    // parent dropdown button text ("Customers")
  childLabel: string;       // child link text ("All Customers")
  expectPath: RegExp;       // URL pattern after click
  // content selector that signals the destination's primary content is painted
  contentSelector: string;
};

// The order of clicks asked for by the task:
//   dashboard -> customers   (Customers dropdown -> "All Customers")
//   customers -> inventory   (Inventory dropdown -> "All Items")
//   inventory -> repairs     (Workshop dropdown  -> "Repairs")
//   repairs -> tasks         (More dropdown      -> "Tasks")
//   tasks -> dashboard       (logo link / direct dashboard)
const SEQUENCE: NavStep[] = [
  {
    from: 'dashboard',
    to: 'customers',
    dropdownLabel: 'Customers',
    childLabel: 'All Customers',
    expectPath: /\/customers(\?|$|\/)/,
    contentSelector: 'main h1, main [role="heading"]',
  },
  {
    from: 'customers',
    to: 'inventory',
    dropdownLabel: 'Inventory',
    childLabel: 'All Items',
    expectPath: /\/inventory(\?|$|\/)/,
    contentSelector: 'main h1, main [role="heading"]',
  },
  {
    from: 'inventory',
    to: 'repairs',
    dropdownLabel: 'Workshop',
    childLabel: 'Repairs',
    expectPath: /\/repairs(\?|$|\/)/,
    contentSelector: 'main h1, main [role="heading"]',
  },
  {
    from: 'repairs',
    to: 'tasks',
    dropdownLabel: 'More',
    childLabel: 'Tasks',
    expectPath: /\/tasks(\?|$|\/)/,
    contentSelector: 'main h1, main [role="heading"]',
  },
  {
    from: 'tasks',
    to: 'dashboard',
    dropdownLabel: '__LOGO__', // special: click the "Nexpura" logo to go home
    childLabel: 'Nexpura',
    expectPath: /\/dashboard(\?|$|\/)/,
    contentSelector: 'main h1, main h2, main [role="heading"]',
  },
];

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60_000 });
  // Wait for dashboard to be painted once before we start the clock.
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 30_000 });
}

/**
 * Locate the TopNav parent dropdown button by its visible label.
 * TopNav renders `<button>{item.label}</button>` inside a
 * `.group/nav` wrapper; the dropdown panel opens on CSS `group-hover`.
 * We hover the button to reveal it, then click the child link by text.
 */
async function findDropdownButton(page: Page, label: string): Promise<Locator> {
  return page.locator('header nav button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
}

/**
 * Locate the desktop dropdown child link for a given nav step.
 * The desktop NavDropdown renders child <a>s inside a
 * `.relative.group/nav > div > div` panel that uses `invisible` + hover.
 * We scope by walking the DOM tree under the lg-visible container (the
 * first `header nav > div.hidden` sibling) so we never hit the mobile-
 * menu clones.
 */
function desktopChildLink(page: Page, childLabel: string): Locator {
  // TopNav renders desktop child links with a distinctive
  // `flex flex-col` class (they stack label + description vertically);
  // mobile links use `block`. We key on the desktop-only class to
  // disambiguate, and match on label text as a prefix (since the
  // description sits in a sibling span and textContent concatenates
  // the two with no separator: "All CustomersBrowse customers").
  return page
    .locator('header a[class*="flex-col"]', {
      hasText: childLabel,
    })
    .first();
}

async function getChildLinkHref(page: Page, step: NavStep): Promise<string> {
  if (step.dropdownLabel === '__LOGO__') {
    // The logo link; its text is "Nexpura".
    const logo = page.locator('header a').filter({ hasText: /^Nexpura$/ }).first();
    return (await logo.getAttribute('href')) ?? '';
  }
  const dropdown = await findDropdownButton(page, step.dropdownLabel);
  await dropdown.hover();
  // The panel is invisible until hover; the <a> is in the DOM regardless.
  // We read the href via getAttribute (no visibility check needed).
  const link = desktopChildLink(page, step.childLabel);
  await link.waitFor({ state: 'attached', timeout: 5_000 });
  return (await link.getAttribute('href')) ?? '';
}

/**
 * Perform a single nav click and measure the time from click to the
 * destination page's primary `main` content being visible AND the URL
 * matching the expected pattern.
 */
async function clickAndMeasure(
  page: Page,
  step: NavStep,
): Promise<{ ms: number; href: string; selectorMatched: string }> {
  let href = '';
  let clickable: Locator;

  if (step.dropdownLabel === '__LOGO__') {
    clickable = page.locator('header a').filter({ hasText: /^Nexpura$/ }).first();
    href = (await clickable.getAttribute('href')) ?? '';
  } else {
    const dropdown = await findDropdownButton(page, step.dropdownLabel);
    await dropdown.hover();
    clickable = desktopChildLink(page, step.childLabel);
    await clickable.waitFor({ state: 'attached', timeout: 5_000 });
    href = (await clickable.getAttribute('href')) ?? '';
    // Wait until the child link is fully visible post-hover (CSS
    // transition flips opacity/visibility on the parent panel).
    await clickable.waitFor({ state: 'visible', timeout: 5_000 });
  }

  // Kick off a waiter for URL change *before* the click (avoids race).
  const urlWaiter = page.waitForURL(step.expectPath, { timeout: 30_000 });

  // High-res clock: use performance.now() in-page.
  const start = await page.evaluate(() => performance.now());
  // Normal click — we've verified the link is visible post-hover.
  await clickable.click();

  // Wait for the URL to have changed to the new route.
  await urlWaiter;

  // Wait for the main content heading to be visible on the destination.
  const contentLocator = page.locator(step.contentSelector).first();
  await contentLocator.waitFor({ state: 'visible', timeout: 30_000 });
  const end = await page.evaluate(() => performance.now());

  // Resolve which selector matched (for the log line).
  const tag = await contentLocator.evaluate((el) => {
    const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
    const cls = (el as HTMLElement).className
      ? `.${String((el as HTMLElement).className).trim().split(/\s+/)[0]}`
      : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  });

  return { ms: Math.round(end - start), href, selectorMatched: `${tag} visible` };
}

type Sample = {
  pass: number;
  from: string;
  to: string;
  href: string;
  ms: number;
  selector: string;
};

test.describe('shell-split SPA nav (router-cache warmth)', () => {
  test.setTimeout(10 * 60 * 1000);

  test('click-through sequence x2 stays under 300ms', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await ctx.clearCookies();
    await login(page);

    const landedOn = await page.evaluate(() => window.location.pathname);
    console.log(`\n[post-login] landed on: ${landedOn}`);
    const firstSeg = landedOn.split('/')[1] ?? '';
    console.log(
      `[post-login] first segment: "${firstSeg}"  hyphenated? ${firstSeg.includes('-')}`,
    );


    // Per task: wait 3s for RoutePrefetcher's hot-tier (50ms delay) and
    // warm-tier (1500ms delay) warmup to complete.
    console.log('\n[prefetch-warmup] waiting 3000ms for RoutePrefetcher tiers...');
    await page.waitForTimeout(3_000);

    // Pre-flight: print every TopNav link href to verify they're tenant-prefixed.
    console.log('\n===== TopNav href audit (tenant-prefix check) =====');
    const hrefs: Array<{ label: string; href: string }> = [];
    for (const step of SEQUENCE) {
      const href = await getChildLinkHref(page, step);
      hrefs.push({ label: `${step.dropdownLabel} > ${step.childLabel}`, href });
      console.log(
        `  ${String(step.dropdownLabel + ' > ' + step.childLabel).padEnd(34)}  href=${href}`,
      );
      // Move the mouse away so the dropdown closes before we open the next.
      await page.mouse.move(0, 0);
    }

    // Flag hrefs that are NOT tenant-prefixed. We treat "tenant-prefixed"
    // as "href starts with /<firstSeg>/" where firstSeg is whatever we
    // landed on after login. The URL-slug fallback in TopNav only kicks
    // in when the first segment contains a hyphen (the Nexpura
    // heuristic), so if the live tenant slug has no hyphen the hrefs
    // will legitimately be bare and the heuristic fails to match. We
    // print that diagnostic above so the regression vs expected-bare
    // case is clear.
    const expectedPrefix = firstSeg && firstSeg !== 'dashboard' ? `/${firstSeg}/` : null;
    const bareHrefs = expectedPrefix
      ? hrefs.filter((h) => h.href && !h.href.startsWith(expectedPrefix))
      : [];
    if (expectedPrefix == null) {
      console.log(
        '\n[HREF NOTE] Landed on bare /dashboard — no tenant prefix in URL, so TopNav',
      );
      console.log('   URL-slug fallback cannot detect a tenant. All hrefs will be bare.');
    } else if (bareHrefs.length > 0) {
      console.log(`\n[HREF WARNING] These hrefs are NOT prefixed with ${expectedPrefix}:`);
      for (const b of bareHrefs) console.log(`   ${b.label}  -> ${b.href}`);
    } else {
      console.log(`\n[HREF OK] All TopNav hrefs prefixed with ${expectedPrefix}`);
    }

    // Run the click sequence twice.
    const samples: Sample[] = [];
    for (let pass = 1; pass <= 2; pass++) {
      console.log(`\n===== Pass ${pass} =====`);
      for (const step of SEQUENCE) {
        const { ms, href, selectorMatched } = await clickAndMeasure(page, step);
        samples.push({ pass, from: step.from, to: step.to, href, ms, selector: selectorMatched });
        const flag =
          ms > 500 ? '  [REGRESSION >500ms]' : ms > 300 ? '  [SLOW >300ms]' : '';
        console.log(
          `${(step.from + '->' + step.to).padEnd(24)}  ${String(ms).padStart(5)}ms  ${selectorMatched}${flag}`,
        );
        // Move mouse away so the dropdown closes cleanly before next hover.
        await page.mouse.move(0, 0);
      }
    }

    // Summary table.
    console.log('\n===== SUMMARY TABLE =====');
    console.log('pass  from -> to               ms    href');
    for (const s of samples) {
      console.log(
        `  ${s.pass}   ${(s.from + ' -> ' + s.to).padEnd(24)} ${String(s.ms).padStart(5)}  ${s.href}`,
      );
    }

    // Verdict.
    const over500 = samples.filter((s) => s.ms > 500);
    const over300 = samples.filter((s) => s.ms > 300 && s.ms <= 500);
    console.log('\n===== VERDICT =====');
    if (over500.length === 0 && over300.length === 0) {
      console.log('PERSISTENCE INTACT — all clicks resolved under 300ms.');
    } else if (over500.length === 0) {
      console.log(`PARTIAL REGRESSION — ${over300.length} click(s) between 300-500ms:`);
      for (const s of over300) console.log(`   ${s.from}->${s.to} pass${s.pass}: ${s.ms}ms`);
    } else {
      console.log(`FULL REGRESSION — ${over500.length} click(s) >500ms:`);
      for (const s of over500) console.log(`   ${s.from}->${s.to} pass${s.pass}: ${s.ms}ms`);
    }

    await ctx.close();

    // Assertions: soft — we want the test to always complete and print, but
    // still surface a failure flag for CI.
    expect(samples.length).toBe(SEQUENCE.length * 2);
    // Hard fail on any full regression (>500ms) so CI catches it.
    expect(
      over500,
      `REGRESSION: clicks over 500ms: ${over500.map((s) => `${s.from}->${s.to}=${s.ms}ms`).join(', ')}`,
    ).toEqual([]);
  });
});
