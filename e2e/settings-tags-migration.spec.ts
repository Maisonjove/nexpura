import { test, expect } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

/**
 * Verifies the /settings/tags cacheComponents migration didn't break
 * anything user-visible. The route now has:
 *   - synchronous page top-level (shell)
 *   - Suspense-wrapped async body (resolveTenantId + load templates)
 *
 * Assertions:
 *   - hard-nav loads the page
 *   - h1 "Stock Tag Templates" is visible
 *   - After the Suspense body resolves, either TagTemplateManager or
 *     the access-denied fallback renders (both are valid final states).
 *   - No 5xx / hanging-promise error.
 */
test('/settings/tags renders correctly after CC-migration refactor', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });

  // Capture network errors
  const failedResponses: Array<{ url: string; status: number }> = [];
  page.on('response', (res) => {
    if (res.status() >= 500 && res.url().includes('/settings/tags')) {
      failedResponses.push({ url: res.url(), status: res.status() });
    }
  });

  // Hard-nav to /settings/tags (tenant-prefixed, so /test/settings/tags)
  const target = `${BASE}/test/settings/tags`;
  const t0 = Date.now();
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const domContentLoaded = Date.now() - t0;

  // Shell should be immediately visible
  await page.locator('h1:has-text("Stock Tag Templates")').waitFor({ state: 'visible', timeout: 20000 });
  const shellVisibleMs = Date.now() - t0;

  // Body should resolve — either the manager UI or the access-denied
  // fallback. The skeleton should be replaced.
  const bodyRendered = await Promise.race([
    page
      .locator('text=/stock tag templates/i')
      .nth(1) // anything after the h1 showing template-related content
      .waitFor({ state: 'visible', timeout: 25000 })
      .then(() => 'manager-or-empty'),
    page
      .locator('text=/Not authenticated/i')
      .first()
      .waitFor({ state: 'visible', timeout: 25000 })
      .then(() => 'unauthorized'),
  ]).catch(() => 'timeout');
  const bodyVisibleMs = Date.now() - t0;

  console.log(`\n===== /settings/tags migration load test =====`);
  console.log(`domContentLoaded:       ${domContentLoaded}ms`);
  console.log(`shell h1 visible:       ${shellVisibleMs}ms`);
  console.log(`body final state at:    ${bodyVisibleMs}ms (${bodyRendered})`);
  console.log(`5xx responses:          ${failedResponses.length}`);
  for (const r of failedResponses) console.log(`   ${r.status} ${r.url}`);
  console.log(`==============================================\n`);

  expect(failedResponses.length, 'no 5xx errors on /settings/tags').toBe(0);
  expect(bodyRendered, 'body did not render').not.toBe('timeout');

  await ctx.close();
});
