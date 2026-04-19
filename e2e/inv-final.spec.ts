import { test, Page } from '@playwright/test';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_INVFINAL_2026-04-18_';

test('verify inventory create works on prod', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);

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

  await page.locator('input[name=name]').fill(`${PREFIX}Final_Test_Item`);
  await page.locator('input[name=retail_price]').first().fill('349.99');
  const qty = page.locator('input[name=quantity]').first();
  if (await qty.count()) await qty.fill('2');

  const addBtn = page.locator('button:has-text("ADD ITEM"), button:has-text("Add Item")').first();
  await addBtn.scrollIntoViewIfNeeded().catch(() => {});
  await addBtn.click({ timeout: 8000 });

  // Wait up to 60s for redirect
  let finalUrl = page.url();
  for (let s = 0; s < 60; s++) {
    await page.waitForTimeout(1000);
    finalUrl = page.url();
    if (/\/inventory\/[a-f0-9\-]{30,}(\/|$)/.test(finalUrl)) break;
  }
  await page.screenshot({ path: '/tmp/inv_final.png', fullPage: true });
  const body = await page.locator('body').innerText().catch(() => '');
  const redirected = /\/inventory\/[a-f0-9\-]{30,}/.test(finalUrl);
  const nameShows = body.includes(`${PREFIX}Final_Test_Item`);
  const invId = finalUrl.match(/\/inventory\/([a-f0-9\-]{30,})/)?.[1];
  console.log('FINAL URL:', finalUrl);
  console.log('REDIRECTED:', redirected);
  console.log('NAME SHOWS:', nameShows);
  console.log('INV ID:', invId);
  console.log('NO ERROR BANNER:', !/An error occurred/i.test(body));

  // Regression: check the list page
  await page.goto(`${BASE}/inventory`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const listBody = await page.locator('body').innerText().catch(() => '');
  console.log('ITEM IN LIST:', listBody.includes(`${PREFIX}Final_Test_Item`));

  // Regression: check stock movement view if visible from detail page
  if (invId) {
    await page.goto(`${BASE}/inventory/${invId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const d = await page.locator('body').innerText().catch(() => '');
    console.log('DETAIL PAGE LOADS:', d.length > 200);
    console.log('DETAIL SHOWS NAME:', d.includes(`${PREFIX}Final_Test_Item`));
    console.log('DETAIL SHOWS QTY/STOCK:', /stock|quantity|2\b/i.test(d));
  }
});
