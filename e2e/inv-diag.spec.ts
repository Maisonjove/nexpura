import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const LOG = '/tmp/nexpura-inv-diag.log';

fs.writeFileSync(LOG, `# Inventory 500 diagnostic — ${new Date().toISOString()}\n`);
function log(s: string) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }

test('inv create diag', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);

  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1000);
  });

  // Network trapping
  const reqs: Array<{ method: string; url: string; status?: number; body?: string }> = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && /inventory|action|_next/i.test(req.url())) {
      reqs.push({ method: req.method(), url: req.url() });
    }
  });
  page.on('response', async (res) => {
    if (res.request().method() === 'POST') {
      const u = res.url();
      if (/inventory|action|_next/i.test(u)) {
        const r = reqs.find(x => x.url === u && x.status === undefined);
        if (r) {
          r.status = res.status();
          try { r.body = (await res.text()).slice(0, 4000); } catch { r.body = '<unavailable>'; }
        }
      }
    }
  });
  page.on('pageerror', (err) => log(`PAGE ERROR: ${err.message.slice(0, 400)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      log(`[${msg.type()}] ${msg.text().slice(0, 400)}`);
    }
  });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  log('logged in');

  // Visit /inventory list FIRST to confirm existing items work for this tenant
  await page.goto(`${BASE}/inventory`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const listBody = await page.locator('body').innerText().catch(() => '');
  log(`inventory list length: ${listBody.length}`);
  const itemCount = (listBody.match(/\$[\d,]+/g) || []).length;
  log(`approx price entries on list (items exist?): ${itemCount}`);

  // Now navigate to new
  await page.goto(`${BASE}/inventory/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.locator('input[name=name]').fill('DIAG_TEST_ITEM_1');
  await page.locator('input[name=retail_price]').first().fill('100');

  const buttons = await page.locator('button').all();
  log(`total buttons: ${buttons.length}`);

  // Find and click ADD ITEM
  const addBtn = page.locator('button:has-text("ADD ITEM"), button:has-text("Add Item")').first();
  log(`ADD ITEM count: ${await addBtn.count()}`);
  await addBtn.scrollIntoViewIfNeeded().catch(() => {});
  await addBtn.click({ timeout: 8000 });

  await page.waitForTimeout(15000);
  const afterUrl = page.url();
  log(`after submit url: ${afterUrl}`);

  // Dump all captured POSTs
  log(`\n=== captured POSTs (${reqs.length}) ===`);
  for (const r of reqs) {
    log(`${r.method} ${r.url.slice(0, 140)} → ${r.status ?? '?'}`);
    if (r.body && (r.status === 500 || r.body.length > 0)) {
      log(`  body: ${r.body.slice(0, 1500)}`);
    }
  }
});
