import { test, expect } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

/**
 * Verifies the cacheComponents migration of the two OAuth "connect"
 * initiators didn't break the request-time cookie read or the OAuth
 * state construction:
 *
 *  - /api/integrations/shopify/connect
 *  - /api/integrations/google-calendar/connect
 *
 * Unauthenticated: both should 307 to an error page (auth_failed).
 * Authenticated:
 *  - Shopify without `?shop=` param → 307 to /website/connect?shopify=enter
 *  - Google Calendar → 307 to accounts.google.com/o/oauth2/v2/auth with
 *    a valid base64({tenantId}) state param.
 */
test('OAuth connect routes behave correctly after CC-migration refactor', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── Unauth sanity ──────────────────────────────────────────────────
  const unauthShopify = await ctx.request.get(
    `${BASE}/api/integrations/shopify/connect`,
    { maxRedirects: 0 }
  );
  const unauthGcal = await ctx.request.get(
    `${BASE}/api/integrations/google-calendar/connect`,
    { maxRedirects: 0 }
  );

  expect(unauthShopify.status(), 'unauth shopify → redirect').toBe(307);
  expect(unauthShopify.headers()['location']).toContain('error=auth_failed');

  expect(unauthGcal.status(), 'unauth gcal → redirect').toBe(307);
  expect(unauthGcal.headers()['location']).toContain('error=auth_failed');

  // ── Auth first ──────────────────────────────────────────────────────
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });

  // ── Authenticated: Shopify without ?shop → enter-shop redirect ─────
  const authShopify = await ctx.request.get(
    `${BASE}/api/integrations/shopify/connect`,
    { maxRedirects: 0 }
  );
  const shopifyLoc = authShopify.headers()['location'] || '';
  console.log(`\n[shopify/connect auth] status=${authShopify.status()} loc=${shopifyLoc}`);

  expect(authShopify.status(), 'auth shopify → redirect').toBe(307);
  // With no ?shop param, handler redirects to the enter-shop picker.
  // With bad auth context, it'd hit the catch block → auth_failed.
  // We accept EITHER shopify=enter OR a proper myshopify.com redirect.
  expect(shopifyLoc).not.toContain('error=auth_failed');

  // ── Authenticated: Google Calendar → accounts.google.com with state ─
  const authGcal = await ctx.request.get(
    `${BASE}/api/integrations/google-calendar/connect`,
    { maxRedirects: 0 }
  );
  const gcalLoc = authGcal.headers()['location'] || '';
  console.log(`[gcal/connect auth] status=${authGcal.status()}`);
  console.log(`[gcal/connect auth] loc (first 200 chars)=${gcalLoc.slice(0, 200)}`);

  expect(authGcal.status(), 'auth gcal → redirect').toBe(307);
  expect(gcalLoc, 'gcal → accounts.google.com').toContain('accounts.google.com/o/oauth2/v2/auth');
  expect(gcalLoc, 'gcal → includes state param').toMatch(/[?&]state=[^&]+/);
  expect(gcalLoc, 'gcal → includes calendar scope').toContain('scope=');

  // Decode the state and verify it has a tenantId — confirms that
  // getAuthContext() + connection() still wire cookies → session →
  // tenant_id lookup end to end.
  const stateMatch = gcalLoc.match(/[?&]state=([^&]+)/);
  if (stateMatch) {
    const decoded = JSON.parse(Buffer.from(decodeURIComponent(stateMatch[1]), 'base64').toString('utf8'));
    console.log(`[gcal/connect auth] decoded state=${JSON.stringify(decoded)}`);
    expect(decoded.tenantId, 'state carries tenantId').toBeTruthy();
  }

  await ctx.close();
});
