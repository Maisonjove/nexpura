import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura-ka5nlpvmd-maisonjoves-projects.vercel.app';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

test('inv create trace', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);

  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1000);
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  console.log('logged in');

  await page.goto(`${BASE}/inventory/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.locator('input[name=name]').fill('TRACE_ITEM_1');
  await page.locator('input[name=retail_price]').first().fill('99.99');

  const addBtn = page.locator('button:has-text("ADD ITEM"), button:has-text("Add Item")').first();
  await addBtn.scrollIntoViewIfNeeded().catch(() => {});
  await addBtn.click({ timeout: 8000 });

  // Wait up to 60s for the action to complete (retry loop may take ~15-20s)
  let finalUrl = page.url();
  for (let s = 0; s < 60; s++) {
    await page.waitForTimeout(1000);
    finalUrl = page.url();
    if (/\/inventory\/[a-f0-9\-]{30,}(\/|$)/.test(finalUrl)) break;
    const txt = await page.locator('body').innerText().catch(() => '');
    if (/DEBUG:/i.test(txt)) break;
  }
  await page.screenshot({ path: '/tmp/trace_after.png', fullPage: true });
  const body = await page.locator('body').innerText().catch(() => '');
  const debugMatch = body.match(/DEBUG: [^\n]+/);
  console.log('DEBUG BANNER:', debugMatch ? debugMatch[0].slice(0, 500) : 'NOT FOUND');
  console.log('URL:', finalUrl);
  const redirected = /\/inventory\/[a-f0-9\-]{30,}/.test(finalUrl);
  console.log('REDIRECTED:', redirected);
  fs.writeFileSync('/tmp/trace_error.txt', debugMatch ? debugMatch[0] : body.slice(0, 2000));
});
