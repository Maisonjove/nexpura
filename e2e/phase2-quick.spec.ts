import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P2Q_2026-04-18_';
const RESULTS = '/tmp/nexpura-p2q-results.json';
const SHOTS = '/tmp/nexpura-p2q-screens';
const LOG = '/tmp/nexpura-p2q-log.md';

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(LOG, `# Phase 2 quick retest — ${new Date().toISOString()}\n`);

const results: Record<string, string> = {};
function save() { fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2)); }
function set(k: string, v: string) { results[k] = v; save(); }
function log(s: string) { fs.appendFileSync(LOG, `- ${s}\n`); console.log(s); }

test('quick phase 2 checks', async ({ page, browser }) => {
  test.setTimeout(10 * 60 * 1000);

  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1500);
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  log('logged in');

  // CHECK 1: Customer tracking page substantive content (Flow 1 follow-up)
  log('\n--- CHECK 1: customer tracking page content ---');
  const custCtx = await browser.newContext();
  const custPage = await custCtx.newPage();
  await custPage.goto(`${BASE}/track/RPR-E16A55F4`, { waitUntil: 'networkidle', timeout: 30000 });
  await custPage.waitForTimeout(4000);
  await custPage.screenshot({ path: `${SHOTS}/track_customer_view.png`, fullPage: true });
  const custBody = await custPage.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  log(`tracking body length: ${custBody.length}`);
  log(`body snippet: ${custBody.slice(0, 400).replace(/\n/g, ' | ')}`);
  const hasOrderType = /repair|order|job/i.test(custBody);
  const hasStatus = /intake|assessed|quoted|in[\s_-]?progress|ready|collected/i.test(custBody);
  const notErrorPage = !/404|server error/i.test(custBody);
  set('customer_track_page_loads', (custBody.length > 200 && notErrorPage) ? 'PASS' : 'FAIL');
  set('customer_track_shows_order_type', hasOrderType ? 'PASS' : 'FAIL');
  set('customer_track_shows_status', hasStatus ? 'PASS' : 'FAIL');
  await custCtx.close();

  // CHECK 2: Bespoke title field DOM attrs (Flow 3)
  log('\n--- CHECK 2: bespoke title binding ---');
  await page.goto(`${BASE}/intake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const bespokeTab = page.locator('button:has-text("Bespoke")').first();
  if (await bespokeTab.count()) {
    await bespokeTab.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${SHOTS}/bespoke_tab.png`, fullPage: true });

  const byName = await page.locator('input[name=title]').count();
  const byId = await page.locator('#bespoke-title').count();
  const requiredAttr = byName > 0 ? await page.locator('input[name=title]').first().getAttribute('required').catch(() => null) : null;
  const labelAssociation = await page.locator('label[for=bespoke-title]').count();
  set('bespoke_title_name_attr', byName > 0 ? 'PASS' : 'FAIL');
  set('bespoke_title_id_attr', byId > 0 ? 'PASS' : 'FAIL');
  set('bespoke_title_required_attr', requiredAttr !== null ? 'PASS' : 'FAIL');
  set('bespoke_label_htmlFor', labelAssociation > 0 ? 'PASS' : 'FAIL');
  log(`byName=${byName} byId=${byId} required=${requiredAttr} labelFor=${labelAssociation}`);

  // CHECK 3: Inventory create end-to-end (Flow 4)
  log('\n--- CHECK 3: inventory create redirect ---');
  await page.goto(`${BASE}/inventory/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  await page.locator('input[name=name]').fill(`${PREFIX}Inv_QuickTest`);
  const retail = page.locator('input[name=retail_price]').first();
  if (await retail.count()) await retail.fill('149.99');
  await page.screenshot({ path: `${SHOTS}/inventory_filled.png`, fullPage: true });

  // Find save button — scan for text
  const buttons = await page.locator('button[type=submit], form button').all();
  log(`inventory buttons: ${buttons.length}`);
  let clicked = false;
  for (const b of buttons) {
    const txt = (await b.innerText().catch(() => '')).trim();
    const vis = await b.isVisible().catch(() => false);
    const dis = await b.isDisabled().catch(() => false);
    log(`  btn="${txt}" vis=${vis} dis=${dis}`);
    if (vis && !dis && /save|create|add|submit/i.test(txt)) {
      try {
        await b.scrollIntoViewIfNeeded();
        await b.click({ timeout: 6000 });
        clicked = true;
        log(`  CLICKED: "${txt}"`);
        break;
      } catch (e: any) {
        log(`  click err: ${e.message?.slice(0, 100)}`);
      }
    }
  }
  set('inventory_save_clicked', clicked ? 'PASS' : 'FAIL');

  let navigatedToDetail = false;
  if (clicked) {
    try {
      await page.waitForURL(/\/inventory\/[a-f0-9\-]{30,}(\/|$)/, { timeout: 30000 });
      navigatedToDetail = true;
    } catch {}
    log(`final url: ${page.url()}, navigatedToDetail=${navigatedToDetail}`);
  }
  set('inventory_redirects_to_item_detail', navigatedToDetail ? 'PASS' : 'FAIL');
  await page.screenshot({ path: `${SHOTS}/inventory_after_save.png`, fullPage: true });

  log('\n=== DONE ===');
  log(JSON.stringify(results, null, 2));
});
