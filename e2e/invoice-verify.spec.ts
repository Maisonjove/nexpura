import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';

// Re-check whether the repairs created during the p1 run now have invoices
const repairs = [
  'c1c61470-891d-45fa-b01a-b223810ebb5b',
  'f0cffc7b-04cb-4a76-bc04-6a3ddb1ef322',
  '55e2cde0-fcd6-4e44-92d1-e3cb7655e20b',
];

test('verify invoices landed', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });

  const out: Array<{ repair: string; hasInvoice: boolean; invoiceHref?: string | null; stillCreating: boolean }> = [];
  for (const rid of repairs) {
    await page.goto(`${BASE}/repairs/${rid}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const stillCreating = /Creating invoice/i.test(bodyText);
    const noInv = /No invoice generated/i.test(bodyText);
    const hasInvBadge = /Unpaid|Partially Paid|Fully Paid|Deposit Paid|Invoice/i.test(bodyText) && !noInv;
    const invLink = await page.locator('a[href*="/invoices/"]').first();
    const href = await invLink.count() > 0 ? await invLink.getAttribute('href') : null;
    out.push({ repair: rid, hasInvoice: !!href || hasInvBadge, invoiceHref: href, stillCreating });
    await page.screenshot({ path: `/tmp/nexpura-p1i-screens/verify_${rid.slice(0, 8)}.png`, fullPage: true });
  }
  fs.writeFileSync('/tmp/nexpura-p1i-invverify.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
});
