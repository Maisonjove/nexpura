import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P1D_2026-04-18_';
const SHOTS = '/tmp/nexpura-p1d-screens';
const LOG = '/tmp/nexpura-p1d-log.md';

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(LOG, `# Diagnostic v2 — single-test (preserves session)\n**base=** ${BASE}\n\n`);

function log(s: string) {
  const line = `- ${new Date().toISOString()} — ${s}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {});
}

test('full diagnosis in single test', async ({ page }) => {
  test.setTimeout(180000);

  // 1. login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  log(`login ok: ${page.url()}`);

  // 2. capture network
  const reqs: { method: string; url: string; status?: number }[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' && !/\.(js|css|woff|png|jpg|svg)$/i.test(req.url())) {
      reqs.push({ method: req.method(), url: req.url() });
    }
  });
  page.on('response', async (res) => {
    const rec = reqs.find(r => r.url === res.url() && r.status === undefined);
    if (rec) rec.status = res.status();
    if (/customers|rpc|create/i.test(res.url()) && res.request().method() !== 'GET') {
      log(`← ${res.status()} ${res.request().method()} ${res.url().slice(0, 140)}`);
    }
  });

  // 3. go to /customers/new
  await page.goto(`${BASE}/customers/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  log(`on ${page.url()}`);
  await shot(page, '01_loaded');

  // 4. inventory buttons
  const allButtons = await page.locator('button').all();
  log(`buttons total: ${allButtons.length}`);
  for (let i = 0; i < allButtons.length; i++) {
    const b = allButtons[i];
    const text = (await b.innerText().catch(() => '')).trim().slice(0, 80).replace(/\n/g, ' ');
    const type = await b.getAttribute('type').catch(() => null);
    const disabled = await b.isDisabled().catch(() => null);
    const visible = await b.isVisible().catch(() => null);
    const cls = (await b.getAttribute('class').catch(() => '') || '').slice(0, 70);
    log(`  btn[${i}] type=${type} dis=${disabled} vis=${visible} text="${text}" cls="${cls}"`);
  }

  // 5. annot8 widget check
  const annot8n = await page.locator('[class*=annot8]').count();
  log(`annot8 elements: ${annot8n}`);

  // 6. fill form
  const ff = await page.locator('input[name=first_name]').count();
  log(`first_name input count: ${ff}`);
  if (ff === 0) {
    log(`FATAL: no form inputs on ${page.url()}`);
    return;
  }
  await page.locator('input[name=first_name]').fill(`${PREFIX}Diag_1`);
  await page.locator('input[name=last_name]').fill('QATest');
  await page.locator('input[name=email]').fill('qap1d+c1@nexpura-test.local');
  await page.locator('input[name=mobile]').fill('0400000101');
  await shot(page, '02_filled');

  // 7. Find Create Customer button
  const create = page.locator('button:has-text("Create Customer")').first();
  const ccount = await create.count();
  log(`"Create Customer" buttons: ${ccount}`);

  if (ccount === 0) {
    const formBtns = await page.locator('form button[type=submit]').all();
    log(`form submit buttons: ${formBtns.length}`);
    for (let i = 0; i < formBtns.length; i++) {
      log(`  form[${i}]: "${(await formBtns[i].innerText()).trim().slice(0, 80)}"`);
    }
    return;
  }

  const v = await create.isVisible();
  const d = await create.isDisabled();
  const box = await create.boundingBox();
  log(`Create btn: visible=${v} disabled=${d} box=${JSON.stringify(box)}`);

  // Hide annot8 overlay if present
  await page.evaluate(() => {
    document.querySelectorAll('[class*=annot8]').forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });
  });
  log(`hid annot8 widgets`);

  // Scroll into view
  await create.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(e => log(`scroll: ${e.message}`));
  await page.waitForTimeout(400);
  await shot(page, '03_before_click');

  // 8. Try strategies
  const strategies: [string, () => Promise<void>][] = [
    ['normal',   async () => { await create.click({ timeout: 5000 }); }],
    ['force',    async () => { await create.click({ timeout: 5000, force: true }); }],
    ['keyboard', async () => { await create.focus(); await page.keyboard.press('Enter'); }],
    ['dispatch', async () => { await create.dispatchEvent('click'); }],
  ];

  let winner: string | null = null;
  for (const [name, fn] of strategies) {
    if (winner) break;
    log(`--- strategy: ${name} ---`);
    const priorUrl = page.url();
    const priorCount = reqs.length;
    try {
      await fn();
      await page.waitForTimeout(5000);
      const nowUrl = page.url();
      const newR = reqs.slice(priorCount);
      log(`  url after: ${nowUrl.slice(0, 80)}`);
      log(`  new requests: ${newR.length}`);
      for (const r of newR.slice(0, 5)) {
        log(`    ${r.method} ${r.url.slice(0, 110)} → ${r.status ?? '?'}`);
      }
      if (newR.length > 0 || nowUrl !== priorUrl) winner = name;
    } catch (err: any) {
      log(`  threw: ${err.message.slice(0, 200)}`);
    }
  }

  log(`WINNER: ${winner || 'NONE'}`);
  await shot(page, '04_after');

  try {
    await page.waitForURL(/\/customers\/[a-f0-9\-]{30,}/, { timeout: 20000 });
    log(`SUCCESS: navigated to ${page.url()}`);
  } catch {
    log(`NO REDIRECT: still at ${page.url()}`);
  }
  await shot(page, '05_final');
  log(`total tracked requests: ${reqs.length}`);
});
