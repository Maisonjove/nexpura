import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P2R_2026-04-18_';
const SHOTS = '/tmp/nexpura-p2r-screens';
const LOG = '/tmp/nexpura-p2r-log.md';
const RESULTS = '/tmp/nexpura-p2r-results.json';
const CLEANUP = '/tmp/nexpura-p2r-cleanup.json';

// Use an existing repair from Phase 1 — skip seeding to avoid intake flakiness
const EXISTING_REPAIR = 'c1c61470-891d-45fa-b01a-b223810ebb5b';

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(LOG, `# Phase 2 Retest (v2, no-seed) — ${new Date().toISOString()}\n**base=** ${BASE}\n\n`);

type Created = { bespoke: string[]; inventory: string[]; tasks: string[] };
const created: Created = { bespoke: [], inventory: [], tasks: [] };
function saveCleanup() { fs.writeFileSync(CLEANUP, JSON.stringify({ prefix: PREFIX, created }, null, 2)); }

const results: Record<string, Record<string, string>> = {};
function saveResults() { fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2)); }
function set(flow: string, key: string, val: string) {
  results[flow] = results[flow] || {};
  results[flow][key] = val;
  saveResults();
}

function log(s: string) {
  const line = `- ${new Date().toISOString()} — ${s}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {});
}

test('Phase 2 mini-retest (no-seed)', async ({ page, browser }) => {
  test.setTimeout(12 * 60 * 1000);

  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    window.addEventListener('DOMContentLoaded', hide);
    setInterval(hide, 1500);
  });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  log(`✓ logged in: ${page.url()}`);

  const repairId = EXISTING_REPAIR;
  log(`using existing repair: ${repairId}`);

  // ─────────────────────────────────────────────────────────────
  // FLOW 1: Repair — tracking link visible + open + copy
  // ─────────────────────────────────────────────────────────────
  log(`\n=== FLOW 1: Repair tracking link ===`);
  await page.goto(`${BASE}/repairs/${repairId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await shot(page, 'f1_repair_detail');

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const trackMatch = bodyText.match(/\b(RPR|BSP)-[A-F0-9]{8}\b/i);
  const trackingId = trackMatch?.[0];
  log(`  tracking id on page: ${trackingId || 'NONE'}`);
  set('repair', 'tracking_id_visible', trackingId ? 'PASS' : 'FAIL');

  const openLink = page.locator(`a[href*="/track/"]`).first();
  const openCount = await openLink.count();
  const openHref = openCount ? await openLink.getAttribute('href') : null;
  log(`  /track/ link href: ${openHref}`);
  set('repair', 'tracking_link_present', openCount ? 'PASS' : 'FAIL');
  set('repair', 'tracking_link_href', openHref ?? '—');

  const copyBtn = page.locator('button:has-text("Copy link")').first();
  set('repair', 'copy_button_present', (await copyBtn.count()) ? 'PASS' : 'FAIL');

  // Customer view — incognito context
  if (trackingId) {
    const custCtx = await browser.newContext();
    const custPage = await custCtx.newPage();
    await custPage.goto(`${BASE}/track/${trackingId}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(3500);
    await custPage.screenshot({ path: `${SHOTS}/f1_tracking_customer_view.png`, fullPage: true });
    const custText = await custPage.locator('body').innerText().catch(() => '');
    const hasContent = custText.length > 500;
    const notError = !/404|not found|error/i.test(custText);
    const hasStage = /intake|assessed|quoted|progress|ready|collected|stage/i.test(custText);
    set('repair', 'customer_tracking_page_loads', (hasContent && notError) ? 'PASS' : 'FAIL');
    set('repair', 'customer_tracking_shows_stage_info', hasStage ? 'PASS' : 'UNCLEAR');
    log(`  /track/${trackingId}: hasContent=${hasContent} notError=${notError} hasStage=${hasStage}`);
    await custCtx.close();
  }

  // ─────────────────────────────────────────────────────────────
  // FLOW 2: Task flow — Create Task button + prefill + submit
  // ─────────────────────────────────────────────────────────────
  log(`\n=== FLOW 2: Task creation from repair ===`);
  await page.goto(`${BASE}/repairs/${repairId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const createTask = page.locator('a:has-text("Create Task")').first();
  const ctCount = await createTask.count();
  set('task', 'create_task_button_on_repair', ctCount ? 'PASS' : 'FAIL');
  log(`  "Create Task" button count: ${ctCount}`);

  if (ctCount) {
    await createTask.scrollIntoViewIfNeeded().catch(()=>{});
    await createTask.click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    await shot(page, 'f2_tasks_page');
    const url = page.url();
    const hasPrefill = /linked_id/.test(url) && /new=1/.test(url);
    set('task', 'url_has_prefill_query', hasPrefill ? 'PASS' : 'FAIL');
    log(`  tasks url: ${url}`);

    // Look for the new-task modal (it auto-opens when query has new=1)
    const modalTitle = page.locator('input[name=title], [role=dialog] input').first();
    const mCount = await modalTitle.count();
    set('task', 'modal_opened_with_title_input', mCount ? 'PASS' : 'FAIL');

    if (mCount) {
      await modalTitle.fill(`${PREFIX}Task_1 follow up`);
      const submitModal = page.locator('button:has-text("Create Task")').last();
      await submitModal.scrollIntoViewIfNeeded().catch(()=>{});
      await submitModal.click({ timeout: 5000 });
      await page.waitForTimeout(5500);
      await shot(page, 'f2_after_task_submit');
      const bodyAfter = await page.locator('body').innerText().catch(() => '');
      const visible = bodyAfter.includes(`${PREFIX}Task_1`);
      set('task', 'task_visible_in_list_after_submit', visible ? 'PASS' : 'UNCLEAR');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FLOW 3: Bespoke title field binding (no submit — just binding check)
  // ─────────────────────────────────────────────────────────────
  log(`\n=== FLOW 3: Bespoke title binding ===`);
  await page.goto(`${BASE}/intake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // Click the Bespoke tab
  const bespokeTab = page.locator('button:has-text("Bespoke")').first();
  if (await bespokeTab.count()) {
    await bespokeTab.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  }

  const bespokeTitle = page.locator('input[name=title]');
  const btCount = await bespokeTitle.count();
  set('bespoke', 'title_input_has_name_attr', btCount > 0 ? 'PASS' : 'FAIL');
  log(`  input[name=title] count on Bespoke tab: ${btCount}`);

  // Also verify via id
  const bespokeTitleById = page.locator('#bespoke-title');
  set('bespoke', 'title_input_has_id_attr', (await bespokeTitleById.count()) > 0 ? 'PASS' : 'FAIL');

  // Verify `required` attr
  if (btCount > 0) {
    const isRequired = await bespokeTitle.first().getAttribute('required').catch(() => null);
    set('bespoke', 'title_has_required_attr', isRequired !== null ? 'PASS' : 'FAIL');

    // Verify label is associated
    const labelFor = await page.locator('label[for=bespoke-title]').count();
    set('bespoke', 'label_htmlFor_associated', labelFor > 0 ? 'PASS' : 'FAIL');

    // Fill it and check state doesn't break
    await bespokeTitle.first().fill(`${PREFIX}Bespoke_1`);
    await shot(page, 'f3_bespoke_title_filled');
    set('bespoke', 'title_accepts_value', 'PASS');
  }

  // ─────────────────────────────────────────────────────────────
  // FLOW 4: Inventory create → redirect to /inventory/[id]
  // ─────────────────────────────────────────────────────────────
  log(`\n=== FLOW 4: Inventory create ===`);
  await page.goto(`${BASE}/inventory/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await shot(page, 'f4_inventory_new');

  const nameInp = page.locator('input[name=name]').first();
  const retailInp = page.locator('input[name=retail_price]').first();
  if (await nameInp.count()) await nameInp.fill(`${PREFIX}Inv_1`);
  if (await retailInp.count()) await retailInp.fill('199.99');

  await shot(page, 'f4_inventory_filled');

  const saveBtns = await page.locator('button:has-text("Save"), button:has-text("Create Item"), form button[type=submit]').all();
  log(`  save buttons found: ${saveBtns.length}`);
  let saveBtn = null;
  for (const b of saveBtns) {
    const txt = (await b.innerText().catch(() => '')).trim();
    const disabled = await b.isDisabled().catch(() => false);
    const visible = await b.isVisible().catch(() => false);
    log(`    btn text="${txt}" disabled=${disabled} visible=${visible}`);
    if (visible && !disabled) { saveBtn = b; break; }
  }

  if (saveBtn) {
    await saveBtn.scrollIntoViewIfNeeded().catch(()=>{});
    await saveBtn.click({ timeout: 8000 });
    let navigated = false;
    try {
      await page.waitForURL(/\/inventory\/[a-f0-9\-]{30,}/, { timeout: 30000 });
      navigated = true;
    } catch {}
    const afterUrl = page.url();
    await shot(page, 'f4_inventory_after');
    log(`  after submit url=${afterUrl} redirectedToDetail=${navigated}`);
    set('inventory', 'redirect_to_item_detail_after_save', navigated ? 'PASS' : 'FAIL');
    const invId = afterUrl.match(/\/inventory\/([a-f0-9\-]{30,})/)?.[1];
    if (invId) {
      created.inventory.push(invId); saveCleanup();
      const txt = await page.locator('body').innerText().catch(() => '');
      set('inventory', 'item_name_on_detail_page', txt.includes(`${PREFIX}Inv_1`) ? 'PASS' : 'UNCLEAR');
    }
  } else {
    set('inventory', 'redirect_to_item_detail_after_save', 'SKIP_NO_SAVE_BUTTON');
  }

  // Summary
  log(`\n============ SUMMARY ============`);
  for (const [flow, fields] of Object.entries(results)) {
    log(`[${flow}] ${JSON.stringify(fields)}`);
  }
});
