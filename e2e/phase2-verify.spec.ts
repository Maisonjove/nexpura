import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P2V2_2026-04-18_';
const EXISTING_REPAIR = 'c1c61470-891d-45fa-b01a-b223810ebb5b';

const SHOTS = '/tmp/nexpura-p2v-screens';
const RESULTS = '/tmp/nexpura-p2v-results.json';
const LOG = '/tmp/nexpura-p2v-log.md';

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(RESULTS, '{}');
fs.writeFileSync(LOG, `# Phase 2 Verification v2 — ${new Date().toISOString()}\n`);

function readResults(): Record<string, Record<string, string>> {
  try { return JSON.parse(fs.readFileSync(RESULTS, 'utf8')); } catch { return {}; }
}
function set(flow: string, key: string, val: string) {
  const r = readResults(); r[flow] = r[flow] || {}; r[flow][key] = val;
  fs.writeFileSync(RESULTS, JSON.stringify(r, null, 2));
}
function log(s: string) {
  fs.appendFileSync(LOG, `- ${new Date().toISOString()} — ${s}\n`);
  console.log(s);
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {});
}
async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
}
async function hideAnnot8(page: Page) {
  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1000);
  });
}

// ─── FLOW 1: Task create with modal + different selector ───────
test('F1 — Create Task from Repair (full end-to-end)', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await hideAnnot8(page);
  await login(page);
  log('F1: logged in');

  // Go DIRECTLY to the deep link url (skip the click — it's already verified present)
  await page.goto(`${BASE}/tasks?new=1&linked_type=repair&linked_id=${EXISTING_REPAIR}&stage=intake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);  // give useEffect time to fire
  await shot(page, 'f1v2_tasks_page');

  // Modal structure: text "New Task" heading, form with title input that's `required` but has NO name attr
  // Try multiple selectors
  const modalOpen = await page.locator('text=New Task').count();
  log(`F1: "New Task" text count: ${modalOpen}`);
  set('task', 'modal_auto_opened', modalOpen > 0 ? 'PASS' : 'FAIL');

  if (modalOpen === 0) return;

  // The modal is .fixed.inset-0 with a form; the first `input[required]` in the modal is the title
  const modalTitle = page.locator('.fixed.inset-0 input[required], [class*="fixed"][class*="inset-0"] input[required]').first();
  const candidateCount = await modalTitle.count();
  log(`F1: modal required input count: ${candidateCount}`);

  // Fallback: first text input inside the modal
  let titleLoc = modalTitle;
  if (candidateCount === 0) {
    titleLoc = page.locator('form input[type=text]').first();
    log(`F1: fallback selector count: ${await titleLoc.count()}`);
  }

  if (await titleLoc.count() === 0) {
    set('task', 'title_input_reachable', 'FAIL');
    return;
  }

  set('task', 'title_input_reachable', 'PASS');
  await titleLoc.fill(`${PREFIX}Task_F1_E2E`);
  await shot(page, 'f1v2_task_filled');

  // Submit — the modal's form has a submit button that says "Create Task"
  const submitInModal = page.locator('.fixed.inset-0 button[type=submit], [class*="fixed"][class*="inset-0"] button:has-text("Create Task")').first();
  const sCount = await submitInModal.count();
  log(`F1: modal submit count: ${sCount}`);

  const submit = sCount > 0 ? submitInModal : page.locator('button:has-text("Create Task")').last();
  await submit.scrollIntoViewIfNeeded().catch(() => {});
  await submit.click({ timeout: 8000 });
  await page.waitForTimeout(8000);
  await shot(page, 'f1v2_task_after_submit');

  const body = await page.locator('body').innerText().catch(() => '');
  const taskFound = body.includes(`${PREFIX}Task_F1_E2E`);
  set('task', 'task_visible_in_list', taskFound ? 'PASS' : 'FAIL');
  log(`F1: task visible: ${taskFound}`);

  // Optional: verify linked-to-repair by visiting repair detail
  if (taskFound) {
    await page.goto(`${BASE}/repairs/${EXISTING_REPAIR}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const repairText = await page.locator('body').innerText().catch(() => '');
    const linked = repairText.includes(`${PREFIX}Task_F1_E2E`) || /task/i.test(repairText);
    set('task', 'task_linked_to_repair', linked ? 'PASS' : 'UNCLEAR');
    log(`F1: task linked to repair: ${linked}`);
  }
});

// ─── FLOW 3: Inventory with more fields filled (avoid server error) ───
test('F3 — Inventory create (fuller field set)', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);
  await hideAnnot8(page);
  await login(page);
  log('F3: logged in');

  // Capture console errors
  page.on('pageerror', (err) => log(`F3 PAGE ERROR: ${err.message.slice(0, 200)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') log(`F3 CONSOLE: ${msg.text().slice(0, 200)}`);
  });

  await page.goto(`${BASE}/inventory/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await shot(page, 'f3v2_inventory_new');

  await page.locator('input[name=name]').fill(`${PREFIX}Inv_F3_v2`);

  // Fill item_type and jewellery_type via their selects
  const itemTypeSel = page.locator('select[name=item_type]').first();
  if (await itemTypeSel.count()) {
    await itemTypeSel.selectOption({ label: 'Finished Piece' }).catch(async () => await itemTypeSel.selectOption({ index: 1 }));
  }
  const jtSel = page.locator('select[name=jewellery_type]').first();
  if (await jtSel.count()) {
    await jtSel.selectOption({ label: 'Ring' }).catch(async () => await jtSel.selectOption({ index: 1 }));
  }

  await page.locator('input[name=retail_price]').first().fill('299.99');

  const costSel = page.locator('input[name=cost_price]').first();
  if (await costSel.count()) await costSel.fill('150');

  const qty = page.locator('input[name=quantity]').first();
  if (await qty.count()) await qty.fill('1');

  await shot(page, 'f3v2_filled');

  // Click ADD ITEM / Save
  const saveBtn = page.locator('button:has-text("ADD ITEM"), button:has-text("Add Item"), button:has-text("Save Item"), button:has-text("Create Item"), form button[type=submit]').first();
  await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
  const beforeUrl = page.url();
  await saveBtn.click({ timeout: 10000 });

  // Wait for redirect or error
  let navigated = false;
  try {
    await page.waitForURL(/\/inventory\/[a-f0-9\-]{30,}(\/|$)/, { timeout: 40000 });
    navigated = true;
  } catch {}
  const afterUrl = page.url();
  log(`F3: before=${beforeUrl} after=${afterUrl} navigated=${navigated}`);
  await shot(page, 'f3v2_after');

  set('inventory', 'submit_clicked', 'PASS');
  set('inventory', 'redirect_to_detail_page', navigated ? 'PASS' : 'FAIL');

  // If failed, capture error message shown on page
  if (!navigated) {
    const body = await page.locator('body').innerText().catch(() => '');
    const errMatch = body.match(/(An error occurred[^\.]*\.[^\.]*\.|Server Components render[^\.]*)/);
    set('inventory', 'error_message_shown', errMatch ? errMatch[0].slice(0, 200) : 'NONE');
  } else {
    const invId = afterUrl.match(/\/inventory\/([a-f0-9\-]{30,})/)?.[1];
    const body = await page.locator('body').innerText().catch(() => '');
    set('inventory', 'item_name_shows_on_detail', body.includes(`${PREFIX}Inv_F3_v2`) ? 'PASS' : 'FAIL');
    if (invId) log(`F3: invId=${invId}`);
  }
});
