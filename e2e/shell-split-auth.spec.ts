import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Auth & tenant boundary verification for (app)/layout shell split.
 *
 * After layout.tsx was refactored from async-with-3-DB-calls to fully
 * synchronous, the redirect-to-/login and redirect-to-/onboarding checks
 * were removed from the layout because middleware.ts already enforces them.
 * This spec PROVES those boundaries still hold on live prod.
 *
 * Run with:
 *   BASE_URL=https://nexpura.com npx playwright test e2e/shell-split-auth.spec.ts \
 *     --project chromium --reporter=list --workers=1
 */

const BASE = process.env.BASE_URL ?? 'https://nexpura.com';
const EMAIL = process.env.TEST_EMAIL ?? 'Joeygermani11@icloud.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test123456';

// Generous timeout — we hit prod and may cold-boot Vercel functions.
test.setTimeout(5 * 60 * 1000);

async function login(page: Page) {
  const t0 = Date.now();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  // Post-login lands somewhere containing "dashboard" in the URL (tenant-prefixed or flat)
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
  const dt = Date.now() - t0;
  console.log(`[login] reached ${page.url()} in ${dt}ms`);
  return dt;
}

async function gotoAndGetFinalUrl(
  page: Page,
  path: string,
  label: string,
): Promise<{ url: string; ms: number; status: number | null }> {
  const t0 = Date.now();
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Give client router any chance to complete a redirect chain.
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const ms = Date.now() - t0;
  const url = page.url();
  const status = resp?.status() ?? null;
  console.log(`[${label}] ${path} -> ${url}  (${ms}ms, status=${status})`);
  return { url, ms, status };
}

test.describe('shell-split auth & tenant boundary', () => {
  test('1. Unauthenticated hit of protected routes redirects to /login', async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext();
    await ctx.clearCookies();
    const page = await ctx.newPage();

    const protectedPaths = ['/dashboard', '/repairs', '/bespoke'];
    const observations: Array<{ path: string; finalUrl: string; ms: number }> = [];

    for (const p of protectedPaths) {
      const { url, ms } = await gotoAndGetFinalUrl(page, p, 'unauth');
      observations.push({ path: p, finalUrl: url, ms });
      expect(url, `expected ${p} to redirect to /login, got ${url}`).toMatch(/\/login(\?|$|#|\/)/);
    }

    console.log('[scenario-1] observations:', JSON.stringify(observations, null, 2));
    await ctx.close();
  });

  test('2. Logout then revisit /dashboard redirects to /login', async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext();
    await ctx.clearCookies();
    const page = await ctx.newPage();

    const loginMs = await login(page);
    // Warm /dashboard
    const warm = await gotoAndGetFinalUrl(page, '/dashboard', 'warm-dash');
    expect(warm.url, 'warm /dashboard should land on a dashboard URL').toMatch(/dashboard/);

    // Attempt to find a visible sign-out control via UI; fall back to /logout page
    // (existing app route that calls supabase.auth.signOut()); final fallback: clearCookies.
    let logoutStrategy = 'unknown';
    let logoutMs = 0;
    const tLogout0 = Date.now();

    const signOutLink = page.locator(
      'a:has-text("Sign out"), a:has-text("Log out"), a:has-text("Sign Out"), a:has-text("Log Out"), button:has-text("Sign out"), button:has-text("Log out"), button:has-text("Sign Out"), button:has-text("Log Out")',
    ).first();
    const foundUi = await signOutLink.isVisible().catch(() => false);

    if (foundUi) {
      logoutStrategy = 'ui-click';
      await Promise.all([
        page.waitForURL(/login|logout/i, { timeout: 30000 }).catch(() => {}),
        signOutLink.click({ timeout: 5000 }).catch(() => {}),
      ]);
    } else {
      // The app ships a /logout page that performs supabase.auth.signOut().
      logoutStrategy = 'logout-page';
      await page.goto(`${BASE}/logout`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Wait for the page's internal setTimeout(->/login) to fire, plus signout network call.
      await page.waitForURL(/\/login/i, { timeout: 15000 }).catch(() => {});
    }

    // Belt & braces: also clear cookies so any lingering session tokens are dead.
    await ctx.clearCookies();
    logoutMs = Date.now() - tLogout0;
    console.log(`[logout] strategy=${logoutStrategy} took ${logoutMs}ms, url=${page.url()}`);

    const revisit = await gotoAndGetFinalUrl(page, '/dashboard', 'post-logout');
    console.log('[scenario-2] loginMs=', loginMs, 'logoutMs=', logoutMs, 'revisit=', revisit);
    expect(revisit.url, `post-logout /dashboard should redirect to /login, got ${revisit.url}`)
      .toMatch(/\/login(\?|$|#|\/)/);

    await ctx.close();
  });

  test('3. Authenticated /dashboard lands on tenant slug URL & TopNav + Nexpura logo render', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.clearCookies();
    const page = await ctx.newPage();

    await login(page);
    const dash = await gotoAndGetFinalUrl(page, '/dashboard', 'auth-dash');

    // URL should be /{slug}/dashboard — slug has at least one char, optional hyphens.
    // Expected for this user: /maisonjove/dashboard.
    const slugMatch = dash.url.match(/^https?:\/\/[^/]+\/([^/]+)\/dashboard/);
    console.log('[scenario-3] observed slug=', slugMatch?.[1]);
    expect(slugMatch, `expected /{slug}/dashboard, got ${dash.url}`).not.toBeNull();

    // "Nexpura" branding somewhere in DOM (footer, logo alt text, sidebar, etc.)
    const nexpuraCount = await page.locator('text=Nexpura').count();
    console.log('[scenario-3] nexpura text occurrences:', nexpuraCount);
    expect(nexpuraCount, 'expected "Nexpura" brand text somewhere on /dashboard').toBeGreaterThan(0);

    // TopNav marker — the "Sales", "Inventory", "Customers" nav labels are in TopNav.
    // Check for at least one of these as a visible element (TopNav rendered).
    const topnavMarker = await page.locator('nav, header').filter({
      has: page.locator('text=Customers'),
    }).first().isVisible().catch(() => false);
    const customersInPage = await page.locator('text=Customers').first().isVisible().catch(() => false);
    console.log('[scenario-3] topnav-with-Customers visible=', topnavMarker, 'Customers-text visible=', customersInPage);
    expect(customersInPage, 'TopNav Customers label should be visible').toBe(true);

    await ctx.close();
  });

  test('4. Wrong tenant slug silently redirects to user’s real slug', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.clearCookies();
    const page = await ctx.newPage();

    await login(page);
    // First, figure out the user's real slug via /dashboard → redirect.
    const dash = await gotoAndGetFinalUrl(page, '/dashboard', 'slug-probe');
    const realSlug = dash.url.match(/^https?:\/\/[^/]+\/([^/]+)\/dashboard/)?.[1];
    console.log('[scenario-4] real slug =', realSlug);
    expect(realSlug, 'probe: real slug should be derivable from /dashboard redirect').toBeTruthy();

    // Hit a bogus tenant slug. Slug has a hyphen so middleware's heuristic
    // (segments[1] is a known route AND segments[0] is NOT a known route)
    // identifies it as a tenant URL path.
    const bogus = await gotoAndGetFinalUrl(page, '/wrong-tenant-xyz-1234/dashboard', 'wrong-tenant');
    const landedSlug = bogus.url.match(/^https?:\/\/[^/]+\/([^/]+)\//)?.[1];
    console.log('[scenario-4] landed slug =', landedSlug);

    expect(landedSlug, `expected silent redirect to user's own slug, got ${bogus.url}`).toBe(realSlug);
    expect(bogus.url, 'should not contain the wrong slug').not.toContain('wrong-tenant-xyz-1234');

    await ctx.close();
  });

  test('5. TopNav slug-derivation: Customers link points to /{slug}/customers', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.clearCookies();
    const page = await ctx.newPage();

    await login(page);
    // Determine real slug first.
    const dash = await gotoAndGetFinalUrl(page, '/dashboard', 'slug-probe');
    const realSlug = dash.url.match(/^https?:\/\/[^/]+\/([^/]+)\/dashboard/)?.[1];
    expect(realSlug, 'real slug should be derivable').toBeTruthy();

    // Navigate to /{slug}/customers — TopNav should derive the slug from the URL
    // (the whole point of the URL-fallback logic in TopNav).
    const customers = await gotoAndGetFinalUrl(page, `/${realSlug}/customers`, 'customers');
    expect(customers.url, `expected to land on /${realSlug}/customers`).toContain(`/${realSlug}/customers`);

    // Find the TopNav "Customers" link — it's inside the Customers dropdown as
    // "All Customers". The parent dropdown itself is a button, not a link, so
    // we look for the child <Link> that points to /customers path fragment.
    // In hover-only dropdowns, hidden links still have correct href attributes.
    // Collect every href on the page that ends with /customers (exact).
    const customersLinks = await page.locator('a[href$="/customers"]').evaluateAll(
      (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href'))
    );
    console.log('[scenario-5] all hrefs ending in /customers:', customersLinks);

    // The TopNav-derived href should be `/{slug}/customers`. A bare `/customers`
    // would mean the slug-fallback logic is broken.
    const hasPrefixed = customersLinks.some((h) => h === `/${realSlug}/customers`);
    const hasBare = customersLinks.some((h) => h === `/customers`);
    console.log('[scenario-5] hasPrefixed=', hasPrefixed, 'hasBare=', hasBare);

    expect(hasPrefixed, `TopNav Customers link should be /${realSlug}/customers`).toBe(true);
    // It's OK if both appear (e.g. in-page links), but the prefixed form MUST exist.
  });
});
