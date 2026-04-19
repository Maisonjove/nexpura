/**
 * Nexpura Phase-1 Integration Validation — post-fix run
 * Validates 3 fixes deployed to production:
 *   1. Customer picker persistence (was dropping customer_id on save)
 *   2. Create Invoice button in StatusStrip (was a static chip)
 *   3. Cookie-domain fix allowing nexpura-delta.vercel.app session persistence
 *
 * 4 runs total:
 *   Runs 1-3: pre-create customer via /customers/new, then pick in /intake
 *   Run 4:    inline-create-and-pick customer inside /intake
 */
import { test, expect, Page, BrowserContext, Browser, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P1_2026-04-18_';

const SCREENS_DIR = '/tmp/nexpura-p1-screens';
const REPORT_PATH = '/tmp/nexpura-p1-report.md';
const FINAL_PATH = '/tmp/nexpura-p1-final.md';
const CLEANUP_PATH = '/tmp/nexpura-p1-cleanup.json';
const STORAGE_STATE = '/tmp/nexpura-p1-storage.json';
const CONSOLE_LOG = '/tmp/nexpura-p1-console.log';
const RESULTS_PATH = '/tmp/nexpura-p1-results.json';

fs.mkdirSync(SCREENS_DIR, { recursive: true });

// Fresh report on each full run (not per-test).
if (!process.env.SKIP_REPORT_INIT) {
  fs.writeFileSync(REPORT_PATH, `# Nexpura Phase-1 Integration Report\n\n**Date:** 2026-04-18\n**BASE_URL:** ${BASE_URL}\n**Prefix:** ${PREFIX}\n\n`);
  fs.writeFileSync(CONSOLE_LOG, '');
  fs.writeFileSync(CLEANUP_PATH, JSON.stringify({
    started_at: new Date().toISOString(),
    base_url: BASE_URL,
    prefix: PREFIX,
    created: { customers: [], repairs: [], invoices: [], payments: [] },
  }, null, 2));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify({ runs: {} }, null, 2));
  process.env.SKIP_REPORT_INIT = '1';
}

const nowISO = () => new Date().toISOString();
const appendReport = (l: string) => fs.appendFileSync(REPORT_PATH, l + '\n');
const logT = (m: string) => appendReport(`- ${nowISO()} — ${m}`);

const loadCleanup = () => JSON.parse(fs.readFileSync(CLEANUP_PATH, 'utf8'));
const saveCleanup = (d: any) => fs.writeFileSync(CLEANUP_PATH, JSON.stringify(d, null, 2));
const addCreated = (k: 'customers' | 'repairs' | 'invoices' | 'payments', e: any) => {
  const c = loadCleanup();
  c.created[k].push(e);
  saveCleanup(c);
};

const loadResults = () => JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
const setResult = (runN: number, key: string, value: any) => {
  const r = loadResults();
  r.runs[runN] = r.runs[runN] || {};
  r.runs[runN][key] = value;
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(r, null, 2));
};

async function screenshot(page: Page, name: string) {
  try { await page.screenshot({ path: path.join(SCREENS_DIR, name.replace(/[^a-z0-9_\-]/gi,'_') + '.png'), timeout: 5000 }); } catch {}
}

function attach(page: Page, tag: string) {
  page.on('console', (m) => { if (['error','warning'].includes(m.type())) fs.appendFileSync(CONSOLE_LOG, `[${tag}] ${m.type()}: ${m.text().slice(0,300)}\n`); });
  page.on('pageerror', (e) => fs.appendFileSync(CONSOLE_LOG, `[${tag}] pageerror: ${e.message.slice(0,300)}\n`));
  page.on('response', (r) => { if (r.status() >= 500) fs.appendFileSync(CONSOLE_LOG, `[${tag}] HTTP ${r.status()} ${r.url()}\n`); });
}

async function sfn<T>(fn: () => Promise<T>, fb: T, tag = ''): Promise<T> {
  try { return await fn(); } catch (e) { if (tag) fs.appendFileSync(CONSOLE_LOG, `[safe:${tag}] ${(e as Error).message.slice(0,200)}\n`); return fb; }
}

async function goto(page: Page, pathname: string, timeout = 45000) {
  const start = Date.now();
  await sfn(() => page.goto(BASE_URL + pathname, { waitUntil: 'domcontentloaded', timeout }), null, `goto:${pathname}`);
  await page.waitForTimeout(2500);
  const ms = Date.now() - start;
  logT(`nav ${pathname} → ${page.url()} (${ms}ms)${ms > 5000 ? ' SLOW' : ''}`);
  return ms;
}

function extractId(url: string, kind: string): string | null {
  const m = url.match(new RegExp(`/${kind}/([a-f0-9\\-]{30,})`, 'i'));
  return m?.[1] ?? null;
}

let _storageReady = false;
async function ensureLogin(browser: Browser): Promise<BrowserContext> {
  const opts: any = { viewport: { width: 1440, height: 900 }, baseURL: BASE_URL };
  if (_storageReady && fs.existsSync(STORAGE_STATE)) opts.storageState = STORAGE_STATE;
  const ctx = await browser.newContext(opts);
  if (_storageReady) return ctx;

  const page = await ctx.newPage();
  attach(page, 'login');
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await sfn(() => page.waitForURL((u) => !/\/login|\/signup|\/verify/.test(u.pathname), { timeout: 30000 }), null);
  await page.waitForTimeout(3000);
  const cookies = await ctx.cookies();
  const hasAuth = cookies.some(c => c.name.includes('auth-token'));
  logT(`login: hasAuth=${hasAuth} finalUrl=${page.url()}`);
  if (!hasAuth) fs.appendFileSync(CONSOLE_LOG, `[login] NO AUTH COOKIE at ${page.url()}\n`);
  await ctx.storageState({ path: STORAGE_STATE });
  _storageReady = true;
  await page.close();
  return ctx;
}

/** Step A — Create customer via /customers/new, return id. */
async function createCustomerViaForm(page: Page, runN: number): Promise<{ id: string | null; fullName: string }> {
  const first = `${PREFIX}Customer_${runN}`;
  const last = 'QATest';
  const email = `qap1+c${runN}@nexpura-test.local`;
  const mobile = `0400000${runN}00`;
  const fullName = `${first} ${last}`;

  await goto(page, '/customers/new');
  await screenshot(page, `run${runN}_A_1_customers_new`);

  await sfn(() => page.locator('input[name="first_name"]').fill(first), null, 'fill first');
  await sfn(() => page.locator('input[name="last_name"]').fill(last), null, 'fill last');
  await sfn(() => page.locator('input[name="email"]').fill(email), null, 'fill email');
  await sfn(() => page.locator('input[name="mobile"]').fill(mobile), null, 'fill mobile');
  await screenshot(page, `run${runN}_A_2_filled`);

  // Submit
  const submitBtn = page.locator('form button[type=submit]').first();
  await sfn(() => submitBtn.click({ timeout: 5000 }), null, 'click submit');
  await sfn(() => page.waitForURL(/\/customers\/[a-f0-9\-]{30,}/, { timeout: 20000 }), null, 'wait customer url');
  await page.waitForTimeout(2000);
  await screenshot(page, `run${runN}_A_3_after_save`);

  const id = extractId(page.url(), 'customers');
  if (id) addCreated('customers', { id, name: fullName, run: runN, inline: false });
  logT(`run${runN} customer created: ${id} (${fullName})`);
  return { id, fullName };
}

/** Step B — Create repair via /intake, picking the customer by name. Returns { repairId, pickerDisplayed, customerPersisted }. */
async function createRepairViaIntake(page: Page, runN: number, customerName: string): Promise<{
  repairId: string | null;
  pickerDisplayed: boolean;
  customerPersisted: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
}> {
  await goto(page, '/intake');
  await screenshot(page, `run${runN}_B_1_intake`);

  // Locate search input
  const search = page.locator('input[placeholder*="name, phone"]').first();
  await sfn(() => search.click(), null, 'focus search');
  await sfn(() => search.fill(customerName), null, 'type search');
  logT(`run${runN} typed customer search: ${customerName}`);
  await page.waitForTimeout(2500); // wait for debounce + fetch
  await screenshot(page, `run${runN}_B_2_dropdown`);

  // Click the matching dropdown entry
  const dropdownItem = page.locator(`button:has-text("${customerName}")`).first();
  const cnt = await sfn(() => dropdownItem.count(), 0);
  if (!cnt) {
    logT(`run${runN} DROPDOWN RESULT NOT FOUND for "${customerName}"`);
  } else {
    await sfn(() => dropdownItem.click({ timeout: 4000 }), null, 'click dropdown item');
  }
  await page.waitForTimeout(1500);
  await screenshot(page, `run${runN}_B_3_after_pick`);

  // CRITICAL CHECK — Selected Customer Card should appear with the name
  const selectedCard = page.locator(`text="${customerName}"`).first();
  const pickerDisplayed = (await sfn(() => selectedCard.count(), 0)) > 0;
  logT(`run${runN} picker display: ${pickerDisplayed ? 'PASS' : 'FAIL'}`);
  if (!pickerDisplayed) {
    appendReport(`\n**[run${runN}] PICKER_DISPLAY_FAIL** — selected customer card did not show ${customerName}\n`);
  }

  // Pick Item Type — Ring
  const itemTypeSelect = page.locator('select').first();
  await sfn(() => itemTypeSelect.selectOption({ label: 'Ring' }), null, 'select ring');
  await page.waitForTimeout(500);
  await screenshot(page, `run${runN}_B_4_ring_selected`);

  // Description
  const desc = page.locator('textarea').first();
  await sfn(() => desc.fill(`${PREFIX}Repair_${runN} - polish`), null, 'fill desc');

  // Leave price empty — we want the Create Invoice button path to be exercised
  await screenshot(page, `run${runN}_B_5_form_filled`);

  // Submit — "Save & Create Job"
  const saveBtn = page.locator('button:has-text("Save & Create Job")').first();
  await sfn(() => saveBtn.scrollIntoViewIfNeeded({ timeout: 2000 }), null);
  await sfn(() => saveBtn.click({ timeout: 5000 }), null, 'click save');
  await page.waitForTimeout(8000);
  await screenshot(page, `run${runN}_B_6_after_submit`);

  // Extract repair id — look at current URL or success-screen links
  let repairId = extractId(page.url(), 'repairs');
  if (!repairId) {
    const links = page.locator('a[href*="/repairs/"]');
    const n = await sfn(() => links.count(), 0);
    for (let i = 0; i < n; i++) {
      const href = await sfn(() => links.nth(i).getAttribute('href'), null);
      const m = href?.match(/\/repairs\/([a-f0-9\-]{30,})/i);
      if (m) { repairId = m[1]; break; }
    }
  }

  if (!repairId) {
    logT(`run${runN} REPAIR_ID not captured — screenshot saved for diagnosis`);
    return { repairId: null, pickerDisplayed, customerPersisted: 'NOT_VERIFIED' };
  }
  addCreated('repairs', { id: repairId, run: runN, desc: `${PREFIX}Repair_${runN}` });
  logT(`run${runN} repair created: ${repairId}`);

  // CRITICAL CHECK — visit /repairs/{id} and confirm the customer shows
  await goto(page, `/repairs/${repairId}`);
  await page.waitForTimeout(2000);
  await screenshot(page, `run${runN}_B_7_repair_detail`);

  // The StatusStrip line shows customer full_name or "—" if null.
  // Grab the body text; fail if we see a "No customer linked" kind of indicator.
  const body = await sfn(() => page.locator('body').innerText(), '');
  const hasCustomerName = body.includes(customerName);
  const hasNoCustomer = /No customer linked|no customer/i.test(body);
  let customerPersisted: 'PASS' | 'FAIL' | 'NOT_VERIFIED' = 'NOT_VERIFIED';
  if (hasCustomerName) customerPersisted = 'PASS';
  else if (hasNoCustomer) customerPersisted = 'FAIL';
  else customerPersisted = 'FAIL'; // no match either way — treat as regression

  logT(`run${runN} customer persistence on repair ${repairId}: ${customerPersisted} (hasName=${hasCustomerName}, hasNoCustomer=${hasNoCustomer})`);
  if (customerPersisted === 'FAIL') {
    appendReport(`\n**[run${runN}] PICKER_PERSIST_FAIL** repairId=${repairId} — customer name "${customerName}" NOT on detail page\n`);
  }

  return { repairId, pickerDisplayed, customerPersisted };
}

/** Inline-create-and-pick customer from within /intake. Returns id & fullName. */
async function createCustomerInlineInIntake(page: Page, runN: number): Promise<{ id: string | null; fullName: string; pickerDisplayed: boolean; }> {
  const first = `${PREFIX}Customer_${runN}`;
  const last = 'QATest';
  const email = `qap1+c${runN}@nexpura-test.local`;
  const phone = `0400000${runN}00`;
  const fullName = `${first} ${last}`;

  await goto(page, '/intake');
  await screenshot(page, `run${runN}_A_1_intake_inline`);

  // Click "Create new customer →"
  const openForm = page.locator('button:has-text("Create new customer")').first();
  await sfn(() => openForm.click({ timeout: 4000 }), null, 'click create-new-customer');
  await page.waitForTimeout(800);
  await screenshot(page, `run${runN}_A_2_inline_form`);

  // The inline form inputs don't have `name` attrs — use placeholder-based selectors
  await sfn(() => page.locator('input[placeholder="First name"]').fill(first), null, 'inline first');
  await sfn(() => page.locator('input[placeholder="Last name"]').fill(last), null, 'inline last');
  await sfn(() => page.locator('input[placeholder="email@example.com"]').fill(email), null, 'inline email');
  await sfn(() => page.locator('input[placeholder="04XX XXX XXX"]').fill(phone), null, 'inline phone');
  await screenshot(page, `run${runN}_A_3_inline_filled`);

  const createBtn = page.locator('button:has-text("Create Customer")').first();
  await sfn(() => createBtn.click({ timeout: 5000 }), null, 'click create customer inline');
  await page.waitForTimeout(3000);
  await screenshot(page, `run${runN}_A_4_after_inline_create`);

  // Picker display check
  const selectedCard = page.locator(`text="${fullName}"`).first();
  const pickerDisplayed = (await sfn(() => selectedCard.count(), 0)) > 0;
  logT(`run${runN} (inline) picker display: ${pickerDisplayed ? 'PASS' : 'FAIL'}`);

  // We don't have the customer id directly — but we'll capture it from the subsequent repair FK if needed.
  // Best-effort: no hidden input exposes it; just move on.
  return { id: null, fullName, pickerDisplayed };
}

/** After inline create + selection, fill in repair form + submit. Mirror of B after picker. */
async function submitRepairAfterInlinePick(page: Page, runN: number, fullName: string): Promise<{
  repairId: string | null;
  customerPersisted: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
}> {
  const itemTypeSelect = page.locator('select').first();
  await sfn(() => itemTypeSelect.selectOption({ label: 'Ring' }), null, 'select ring inline');
  await page.waitForTimeout(500);

  const desc = page.locator('textarea').first();
  await sfn(() => desc.fill(`${PREFIX}Repair_${runN} - polish`), null, 'fill desc inline');
  await screenshot(page, `run${runN}_B_5_form_filled_inline`);

  const saveBtn = page.locator('button:has-text("Save & Create Job")').first();
  await sfn(() => saveBtn.scrollIntoViewIfNeeded({ timeout: 2000 }), null);
  await sfn(() => saveBtn.click({ timeout: 5000 }), null, 'click save inline');
  await page.waitForTimeout(8000);
  await screenshot(page, `run${runN}_B_6_after_submit_inline`);

  let repairId = extractId(page.url(), 'repairs');
  if (!repairId) {
    const links = page.locator('a[href*="/repairs/"]');
    const n = await sfn(() => links.count(), 0);
    for (let i = 0; i < n; i++) {
      const href = await sfn(() => links.nth(i).getAttribute('href'), null);
      const m = href?.match(/\/repairs\/([a-f0-9\-]{30,})/i);
      if (m) { repairId = m[1]; break; }
    }
  }
  if (!repairId) return { repairId: null, customerPersisted: 'NOT_VERIFIED' };
  addCreated('repairs', { id: repairId, run: runN, inline: true, desc: `${PREFIX}Repair_${runN}` });

  await goto(page, `/repairs/${repairId}`);
  await page.waitForTimeout(2000);
  await screenshot(page, `run${runN}_B_7_repair_detail_inline`);

  const body = await sfn(() => page.locator('body').innerText(), '');
  const hasCustomerName = body.includes(fullName);
  const hasNoCustomer = /No customer linked|no customer/i.test(body);
  let customerPersisted: 'PASS' | 'FAIL' | 'NOT_VERIFIED' = 'NOT_VERIFIED';
  if (hasCustomerName) customerPersisted = 'PASS';
  else if (hasNoCustomer) customerPersisted = 'FAIL';
  else customerPersisted = 'FAIL';
  logT(`run${runN} (inline) customer persistence: ${customerPersisted}`);
  if (customerPersisted === 'FAIL') {
    appendReport(`\n**[run${runN}] PICKER_PERSIST_FAIL (inline)** repairId=${repairId}\n`);
  }
  return { repairId, customerPersisted };
}

/** Step C — Click the "📄 Create Invoice" button on repair detail. */
async function createInvoiceCTA(page: Page, runN: number, repairId: string): Promise<{
  invoiceId: string | null;
  ctaPresent: boolean;
  ctaWorked: boolean;
}> {
  await goto(page, `/repairs/${repairId}`);
  await page.waitForTimeout(2000);
  await screenshot(page, `run${runN}_C_1_repair_before_invoice`);

  const cta = page.locator('button:has-text("Create Invoice")').first();
  const ctaPresent = (await sfn(() => cta.count(), 0)) > 0;
  if (!ctaPresent) {
    appendReport(`\n**[run${runN}] INVOICE_CTA_FAIL** — no "Create Invoice" button on /repairs/${repairId}\n`);
    return { invoiceId: null, ctaPresent: false, ctaWorked: false };
  }

  await sfn(() => cta.scrollIntoViewIfNeeded({ timeout: 2000 }), null);
  await sfn(() => cta.click({ timeout: 5000 }), null, 'click create invoice');
  await sfn(() => page.waitForURL(/\/invoices\/[a-f0-9\-]{30,}/, { timeout: 20000 }), null, 'wait invoice url');
  await page.waitForTimeout(2000);
  await screenshot(page, `run${runN}_C_2_invoice_created`);

  const invoiceId = extractId(page.url(), 'invoices');
  const ctaWorked = !!invoiceId;
  if (invoiceId) addCreated('invoices', { id: invoiceId, run: runN, via: 'create_invoice_cta' });
  logT(`run${runN} invoice CTA: present=${ctaPresent} worked=${ctaWorked} invoiceId=${invoiceId}`);
  return { invoiceId, ctaPresent, ctaWorked };
}

/** Read invoice amount from the detail page. Best-effort via visible currency formatting. */
async function readInvoiceTotal(page: Page): Promise<number> {
  const body = await sfn(() => page.locator('body').innerText(), '');
  // Look for "Total" near a dollar amount, or any "$X.XX" pattern
  const m = body.match(/\$([\d,]+(?:\.\d{2})?)/);
  if (m) return parseFloat(m[1].replace(/,/g, ''));
  return 0;
}

/** Step D & E — record a partial payment, verify status, record remainder, verify paid. */
async function recordPayments(page: Page, runN: number, invoiceId: string): Promise<{
  partialOk: boolean;
  fullOk: boolean;
}> {
  await goto(page, `/invoices/${invoiceId}`);
  await page.waitForTimeout(2500);
  await screenshot(page, `run${runN}_D_1_invoice_initial`);

  let total = await readInvoiceTotal(page);
  // If repair had no price, invoice total may be 0 — payments only make sense if > 0.
  if (total <= 0) {
    // Try once more after a small wait
    await page.waitForTimeout(1500);
    total = await readInvoiceTotal(page);
  }
  logT(`run${runN} invoice total read: ${total}`);

  // If total still 0, we can't meaningfully do partial — record symbolic $1 then $0 impossible.
  // In that case, record two $1 payments so we at least exercise the code path.
  const partialAmt = total > 0 ? Math.max(1, Math.round((total / 2) * 100) / 100) : 1;
  const remainderAmt = total > 0 ? Math.max(0.01, total - partialAmt) : 1;

  // --- PARTIAL ---
  const recordBtn = page.locator('button:has-text("Record Payment")').first();
  if (!(await sfn(() => recordBtn.count(), 0))) {
    appendReport(`\n**[run${runN}] RECORD_PAYMENT_BTN_MISSING** invoiceId=${invoiceId}\n`);
    return { partialOk: false, fullOk: false };
  }
  await sfn(() => recordBtn.click({ timeout: 4000 }), null, 'open payment modal partial');
  await page.waitForTimeout(1000);
  const amountInput = page.locator('input[type="number"]').first();
  await sfn(() => amountInput.fill(String(partialAmt)), null, 'fill partial amount');
  await screenshot(page, `run${runN}_D_2_partial_modal`);

  // Click the Record Payment button INSIDE the modal
  const modalSubmit = page.locator('button:has-text("Record Payment")').last();
  await sfn(() => modalSubmit.click({ timeout: 4000 }), null, 'submit partial');
  await page.waitForTimeout(4000);
  await screenshot(page, `run${runN}_D_3_after_partial`);

  const bodyAfterPartial = await sfn(() => page.locator('body').innerText(), '');
  const partialOk = /partial|Partially Paid/i.test(bodyAfterPartial) || bodyAfterPartial.includes(String(partialAmt));
  addCreated('payments', { invoiceId, amount: partialAmt, run: runN, kind: 'partial' });
  logT(`run${runN} partial payment status ok=${partialOk}`);

  // --- FULL REMAINDER ---
  const recordBtn2 = page.locator('button:has-text("Record Payment")').first();
  const anyPayBtn = await sfn(() => recordBtn2.count(), 0);
  if (!anyPayBtn) {
    logT(`run${runN} no Record Payment button for remainder — may already be paid`);
    return { partialOk, fullOk: false };
  }
  await sfn(() => recordBtn2.click({ timeout: 4000 }), null, 'open payment modal full');
  await page.waitForTimeout(1000);
  const amountInput2 = page.locator('input[type="number"]').first();
  await sfn(() => amountInput2.fill(String(remainderAmt)), null, 'fill remainder');
  await screenshot(page, `run${runN}_E_1_remainder_modal`);

  const modalSubmit2 = page.locator('button:has-text("Record Payment")').last();
  await sfn(() => modalSubmit2.click({ timeout: 4000 }), null, 'submit remainder');
  await page.waitForTimeout(4000);
  await screenshot(page, `run${runN}_E_2_after_full`);

  const bodyAfterFull = await sfn(() => page.locator('body').innerText(), '');
  const fullOk = /paid|Fully Paid|Paid in Full/i.test(bodyAfterFull) && !/unpaid/i.test(bodyAfterFull.replace(/fully paid/gi, ''));
  addCreated('payments', { invoiceId, amount: remainderAmt, run: runN, kind: 'full' });
  logT(`run${runN} full payment ok=${fullOk}`);
  return { partialOk, fullOk };
}

/** Step F — check for a /track/ link on the repair, flag as NOT_EXPOSED_IN_UI if missing. */
async function checkTracking(page: Page, runN: number, repairId: string): Promise<'PASS' | 'NOT_EXPOSED_IN_UI' | 'FAIL'> {
  await goto(page, `/repairs/${repairId}`);
  await page.waitForTimeout(2000);

  // Look for an anchor/button href containing `/track/`
  const trackLinks = page.locator('a[href*="/track/"]');
  const n = await sfn(() => trackLinks.count(), 0);
  if (!n) {
    // Also check edit page — tracking_id is shown there per code inspection
    await goto(page, `/repairs/${repairId}/edit`);
    await page.waitForTimeout(1500);
    const trackLinks2 = page.locator('a[href*="/track/"]');
    const n2 = await sfn(() => trackLinks2.count(), 0);
    if (!n2) {
      logT(`run${runN} tracking: NOT_EXPOSED_IN_UI on detail or edit page`);
      return 'NOT_EXPOSED_IN_UI';
    }
    const href2 = await sfn(() => trackLinks2.first().getAttribute('href'), null);
    logT(`run${runN} tracking link found on edit page: ${href2}`);
    return 'PASS';
  }
  const href = await sfn(() => trackLinks.first().getAttribute('href'), null);
  logT(`run${runN} tracking link on detail: ${href}`);
  return 'PASS';
}

// ─── Test orchestration ───────────────────────────────────────────────

test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('Nexpura P1 integration', () => {
  test.setTimeout(360_000);

  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  test.beforeEach(async () => {
    if (!context) {
      context = await ensureLogin(browser);
      page = await context.newPage();
      attach(page, 'main');
    }
  });
  test.afterAll(async () => {
    await sfn(() => context?.storageState({ path: STORAGE_STATE }), null);
    await sfn(() => browser?.close(), null);
  });

  for (const runN of [1, 2, 3]) {
    test(`run ${runN} — pre-create customer + pick + full flow`, async () => {
      appendReport(`\n## Run ${runN} — pre-create customer flow\n`);

      // A
      const { id: customerId, fullName } = await createCustomerViaForm(page, runN);
      setResult(runN, 'customerId', customerId);
      setResult(runN, 'customerName', fullName);
      if (!customerId) {
        appendReport(`\n**[run${runN}] CUSTOMER_CREATE_FAIL** — aborting run\n`);
        setResult(runN, 'aborted', true);
        return;
      }

      // B
      const b = await createRepairViaIntake(page, runN, fullName);
      setResult(runN, 'pickerDisplayed', b.pickerDisplayed);
      setResult(runN, 'customerPersisted', b.customerPersisted);
      setResult(runN, 'repairId', b.repairId);
      if (!b.repairId) { appendReport(`\n**[run${runN}] REPAIR_CREATE_FAIL** — aborting run\n`); return; }

      // C
      const c = await createInvoiceCTA(page, runN, b.repairId);
      setResult(runN, 'invoiceCtaPresent', c.ctaPresent);
      setResult(runN, 'invoiceCtaWorked', c.ctaWorked);
      setResult(runN, 'invoiceId', c.invoiceId);
      if (!c.invoiceId) {
        appendReport(`\n[run${runN}] skipping D/E — no invoice\n`);
      } else {
        // D & E
        const pay = await recordPayments(page, runN, c.invoiceId);
        setResult(runN, 'partialOk', pay.partialOk);
        setResult(runN, 'fullOk', pay.fullOk);
      }

      // F
      const tracking = await checkTracking(page, runN, b.repairId);
      setResult(runN, 'tracking', tracking);
    });
  }

  test('run 4 — inline-create customer inside intake + full flow', async () => {
    const runN = 4;
    appendReport(`\n## Run ${runN} — inline-create flavor\n`);

    const inline = await createCustomerInlineInIntake(page, runN);
    setResult(runN, 'pickerDisplayed', inline.pickerDisplayed);
    setResult(runN, 'customerName', inline.fullName);

    const rep = await submitRepairAfterInlinePick(page, runN, inline.fullName);
    setResult(runN, 'customerPersisted', rep.customerPersisted);
    setResult(runN, 'repairId', rep.repairId);
    if (!rep.repairId) { appendReport(`\n**[run${runN}] REPAIR_CREATE_FAIL (inline)** — aborting run\n`); return; }

    const c = await createInvoiceCTA(page, runN, rep.repairId);
    setResult(runN, 'invoiceCtaPresent', c.ctaPresent);
    setResult(runN, 'invoiceCtaWorked', c.ctaWorked);
    setResult(runN, 'invoiceId', c.invoiceId);
    if (c.invoiceId) {
      const pay = await recordPayments(page, runN, c.invoiceId);
      setResult(runN, 'partialOk', pay.partialOk);
      setResult(runN, 'fullOk', pay.fullOk);
    }
    const tracking = await checkTracking(page, runN, rep.repairId);
    setResult(runN, 'tracking', tracking);
  });

  test('smoke — nexpura-delta preview cookie fix', async () => {
    // This is a read-only smoke, separate browser context, NO shared storage.
    const b = await chromium.launch({ headless: true });
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    attach(p, 'delta');
    let sessionPersists = false;
    let cookieName = '';
    try {
      await p.goto('https://nexpura-delta.vercel.app/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('#email', { timeout: 15000 });
      await p.fill('#email', EMAIL);
      await p.fill('#password', PASSWORD);
      await p.click('button[type=submit]');
      await sfn(() => p.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 25000 }), null, 'delta wait nav');
      await p.waitForTimeout(3000);
      const cookies = await ctx.cookies();
      const auth = cookies.find(c => c.name.includes('auth-token'));
      cookieName = auth?.name || '';
      // Now reload and see if session persists
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2500);
      const finalUrl = p.url();
      sessionPersists = !!auth && !/\/login/.test(finalUrl);
      await screenshot(p, `delta_smoke_after_reload`);
      logT(`delta smoke: cookie=${cookieName} finalUrl=${finalUrl} persists=${sessionPersists}`);
    } catch (e) {
      logT(`delta smoke error: ${(e as Error).message}`);
    } finally {
      await sfn(() => b.close(), null);
    }
    setResult(99, 'deltaSessionPersists', sessionPersists);
    setResult(99, 'deltaAuthCookie', cookieName);
  });

  test('finalize report', async () => {
    const results = loadResults();
    let finalMd = `# Nexpura Phase-1 Integration — FINAL\n\n**Date:** 2026-04-18\n**BASE_URL:** ${BASE_URL}\n**Prefix:** ${PREFIX}\n\n## Per-Run Results\n\n`;

    let persistPasses = 0;
    const persistFails: { run: number; repairId: string | null }[] = [];
    let totalRuns = 0;

    for (const runN of [1, 2, 3, 4]) {
      const r = results.runs[runN] || {};
      totalRuns++;
      if (r.customerPersisted === 'PASS') persistPasses++;
      if (r.customerPersisted === 'FAIL') persistFails.push({ run: runN, repairId: r.repairId || null });

      finalMd += `### Run ${runN}\n`;
      finalMd += `- customer name: \`${r.customerName || '-'}\` (id=\`${r.customerId || '-'}\`)\n`;
      finalMd += `- repair id: \`${r.repairId || '-'}\`\n`;
      finalMd += `- invoice id: \`${r.invoiceId || '-'}\`\n`;
      finalMd += `- picker display: **${r.pickerDisplayed ? 'PASS' : 'FAIL'}**\n`;
      finalMd += `- customer FK persisted on repair: **${r.customerPersisted || 'NOT_VERIFIED'}**\n`;
      finalMd += `- Create Invoice button: **${r.invoiceCtaPresent ? (r.invoiceCtaWorked ? 'PASS' : 'PRESENT_BUT_FAILED') : 'FAIL'}**\n`;
      finalMd += `- partial payment: **${r.partialOk === undefined ? 'SKIPPED' : (r.partialOk ? 'PASS' : 'FAIL')}**\n`;
      finalMd += `- complete payment: **${r.fullOk === undefined ? 'SKIPPED' : (r.fullOk ? 'PASS' : 'FAIL')}**\n`;
      finalMd += `- tracking: **${r.tracking || 'NOT_VERIFIED'}**\n\n`;
    }

    finalMd += `## Overall\n\n`;
    finalMd += `- **Customer persistence stability:** ${persistPasses}/${totalRuns} PASS\n`;
    if (persistFails.length) {
      finalMd += `- **PICKER_PERSIST_FAIL occurrences:**\n`;
      for (const f of persistFails) finalMd += `  - run ${f.run} (repairId=${f.repairId})\n`;
    } else {
      finalMd += `- **PICKER_PERSIST_FAIL:** none\n`;
    }
    const deltaOk = results.runs[99]?.deltaSessionPersists;
    finalMd += `- **nexpura-delta preview smoke:** ${deltaOk ? 'PASS (session persists)' : 'FAIL (session did not persist)'}\n`;
    finalMd += `- **Ready for Phase 2?** ${persistPasses === totalRuns ? 'YES — customer persistence fixed across 4 runs' : 'NO — persistence still failing on ' + persistFails.map(f => 'run ' + f.run).join(', ')}\n`;

    fs.writeFileSync(FINAL_PATH, finalMd);
    logT(`final report written to ${FINAL_PATH}`);
  });
});
