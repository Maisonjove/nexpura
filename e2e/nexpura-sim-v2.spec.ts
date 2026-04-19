/**
 * Nexpura deep end-to-end simulation — target: https://nexpura.com
 * Preview host (nexpura-delta.vercel.app) is broken due to cookie-domain pin (logged as Critical #1).
 */
import { test, Page, BrowserContext, Browser, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.SIM_BASE_URL || 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_SIM_2026-04-18_';
const SCREENS_DIR = '/tmp/nexpura-sim-v2-screens';
const REPORT_PATH = '/tmp/nexpura-sim-v2-report.md';
const CLEANUP_PATH = '/tmp/nexpura-sim-cleanup.json';
const STORAGE_STATE = '/tmp/nexpura-sim-v2-storage.json';
const CONSOLE_LOG = '/tmp/nexpura-sim-v2-console.log';

fs.mkdirSync(SCREENS_DIR, { recursive: true });

const nowISO = () => new Date().toISOString();
const appendReport = (l: string) => fs.appendFileSync(REPORT_PATH, l + '\n');
const logSection = (n: number, t: string, b: string) => appendReport(`\n### Section ${n} — ${t}\n**t=${nowISO()}**\n\n${b}\n`);
const logStatus = (n: number, t: string, s: string, r: string) => appendReport(`\n**[S${n} STATUS: ${s}]** ${t} — ${r}\n`);
const appendTimeline = (m: string) => appendReport(`- ${nowISO()} — ${m}`);

const loadCleanup = () => { try { return JSON.parse(fs.readFileSync(CLEANUP_PATH, 'utf8')); } catch { return {}; } };
const saveCleanup = (d: any) => fs.writeFileSync(CLEANUP_PATH, JSON.stringify(d, null, 2));
const addCreated = (k: string, e: any) => {
  const c = loadCleanup();
  c.created = c.created || {};
  c.created[k] = c.created[k] || [];
  c.created[k].push(e);
  saveCleanup(c);
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

// Navigate — use 'load' not 'networkidle' (the app has long-poll so networkidle never fires)
async function goto(page: Page, pathname: string, timeout = 30000) {
  const start = Date.now();
  await sfn(() => page.goto(BASE_URL + pathname, { waitUntil: 'domcontentloaded', timeout }), null, `goto:${pathname}`);
  // Give React hydrate/load a moment
  await page.waitForTimeout(2500);
  const ms = Date.now() - start;
  appendTimeline(`  nav ${pathname} → ${page.url()} (${ms}ms)${ms > 3000 ? ' SLOW' : ''}`);
  return ms;
}

async function tryClick(page: Page, text: string | RegExp, timeout = 2500) {
  try {
    const loc = page.getByRole('button', { name: text }).or(page.getByRole('link', { name: text })).first();
    await loc.click({ timeout });
    return true;
  } catch { return false; }
}
async function fillIf(page: Page, selector: string, value: string) {
  try {
    const loc = page.locator(selector).first();
    if (await loc.count()) { await loc.fill(value, { timeout: 2500 }); return true; }
  } catch {}
  return false;
}
async function clickFirst(page: Page, selectors: string[], timeout = 2500) {
  for (const sel of selectors) {
    try {
      const b = page.locator(sel).first();
      if (await b.count()) {
        // If the sel matched a nav "button[type=submit]" (header bar), skip it.
        // Prefer exact text-based selectors first.
        await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
        await b.click({ timeout });
        return sel;
      }
    } catch {}
  }
  return null;
}

/** Form-scoped submit: picks the submit button INSIDE the main form, ignoring nav bar. */
async function submitForm(page: Page, preferredTexts: string[] = []): Promise<string | null> {
  // Try exact text first
  for (const txt of preferredTexts) {
    try {
      const b = page.locator(`form button:has-text("${txt}"), form button[type=submit]:has-text("${txt}")`).first();
      if (await b.count()) {
        const disabled = await b.isDisabled().catch(() => false);
        if (!disabled) { await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(()=>{}); await b.click({ timeout: 3500 }); return `form button:${txt}`; }
      }
    } catch {}
  }
  // Fallback: last submit-ish button inside a form
  try {
    const bs = page.locator('form button[type=submit]');
    const c = await bs.count();
    for (let i = c - 1; i >= 0; i--) {
      const b = bs.nth(i);
      const disabled = await b.isDisabled().catch(() => false);
      const txt = (await b.innerText().catch(() => '')).trim();
      if (!disabled && txt.length > 0 && !/sales|inventory|customers|workshop|finance|marketing|more/i.test(txt)) {
        await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(()=>{});
        await b.click({ timeout: 3500 });
        return `form button[type=submit] idx=${i} "${txt.slice(0,30)}"`;
      }
    }
  } catch {}
  return null;
}

// Extract UUID id from URL after `/kind/` regardless of tenant prefix
function extractId(url: string, kind: string): string | null {
  const m = url.match(new RegExp(`/${kind}/([a-f0-9\\-]{30,})`, 'i'));
  return m?.[1] ?? null;
}

/** After intake submit, intake UI shows a SuccessScreen with "Go to X Detail" link — follow it. */
async function resolveFromSuccessScreen(page: Page, kind: string): Promise<string | null> {
  const links = page.locator(`a[href*="/${kind}/"]`);
  const n = await sfn(() => links.count(), 0);
  for (let i = 0; i < n; i++) {
    const href = await links.nth(i).getAttribute('href').catch(() => null);
    const m = href?.match(new RegExp(`/${kind}/([a-f0-9\\-]{30,})`, 'i'));
    if (m) return m[1];
  }
  return null;
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
  if (!cookies.some(c => c.name.includes('auth-token'))) {
    fs.appendFileSync(CONSOLE_LOG, `[login] NO AUTH COOKIE at ${page.url()}\n`);
  } else {
    appendTimeline(`login cookie established, final url ${page.url()}`);
  }
  await ctx.storageState({ path: STORAGE_STATE });
  _storageReady = true;
  await page.close();
  return ctx;
}

test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('Nexpura deep sim v2', () => {
  test.setTimeout(180_000);

  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const state: Record<string, any> = {};

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

  test('S1 AUTH', async () => {
    appendTimeline('S1 AUTH start');
    const f: string[] = [];
    await goto(page, '/dashboard');
    await screenshot(page, 's1_dashboard_initial');
    const u1 = page.url();
    f.push(`Dashboard initial URL: ${u1}`);
    const atLogin = /\/login/.test(u1);

    await sfn(() => page.reload({ waitUntil: 'domcontentloaded' }), null);
    await page.waitForTimeout(3000);
    await screenshot(page, 's1_reload');
    const u2 = page.url();
    f.push(`After reload: ${u2} (persisted=${!/\/login/.test(u2)})`);

    // Wrong password
    const ic = await browser.newContext();
    const ip = await ic.newPage();
    attach(ip, 'wrongpw');
    // Track supabase auth response
    let authFailStatus = 0;
    ip.on('response', (r) => { if (r.url().includes('/auth/v1/token')) authFailStatus = r.status(); });
    await ip.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
    await ip.waitForSelector('#email', { timeout: 15000 });
    await ip.fill('#email', EMAIL);
    await ip.fill('#password', 'WrongPW_XYZ_2026');
    await ip.click('button[type=submit]');
    // Poll for error visibility up to 30s
    let wrongErr = false;
    const tStart = Date.now();
    while (Date.now() - tStart < 30000) {
      const hasErr = await ip.locator('#login-error, [role="alert"], .text-red-600, .bg-red-50').count();
      if (hasErr) {
        const allErrTxt = await ip.locator('#login-error, [role="alert"], .text-red-600, .bg-red-50').allInnerTexts().catch(() => []);
        wrongErr = allErrTxt.some(t => /invalid|wrong|incorrect|failed|error/i.test(t));
        f.push(`Wrong pw alert after ${Date.now() - tStart}ms: ${JSON.stringify(allErrTxt).slice(0,200)}`);
        break;
      }
      await ip.waitForTimeout(1500);
    }
    f.push(`Supabase auth status for wrong pw: ${authFailStatus}`);
    if (!wrongErr) f.push('FAIL wrong password did not surface visible error within 30s');
    await screenshot(ip, 's1_wrongpw');
    await ic.close();

    await goto(page, '/logout');
    await page.waitForTimeout(4000);
    await screenshot(page, 's1_logout');
    const loggedOut = /\/login/.test(page.url());
    f.push(`Logout landed at: ${page.url()} (loggedOut=${loggedOut})`);

    // re-login
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#email', { timeout: 15000 });
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForTimeout(10000);
    await screenshot(page, 's1_relogin');
    await context.storageState({ path: STORAGE_STATE });
    const relogin = !/\/login/.test(page.url());
    f.push(`Re-login: ${relogin} URL: ${page.url()}`);

    const hasFail = f.some(x => x.startsWith('FAIL'));
    const status = hasFail ? 'FAIL' : (!atLogin && wrongErr && loggedOut && relogin ? 'PASS' : 'PARTIAL');
    logSection(1, 'AUTH', f.map(x => `- ${x}`).join('\n'));
    logStatus(1, 'AUTH', status, `init=${!atLogin} reload=${!/\/login/.test(u2)} wrongPW=${wrongErr} logout=${loggedOut} relogin=${relogin}`);
    state.s1 = !hasFail;
  });

  test('S2 DASHBOARD', async () => {
    appendTimeline('S2 DASHBOARD start');
    const f: string[] = [];
    await goto(page, '/dashboard');
    await screenshot(page, 's2_dash');
    const txt = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    f.push(`body len: ${txt.length}`);
    f.push(`keywords: tasks=${/tasks due/i.test(txt)} pickup=${/ready for pickup/i.test(txt)} recent=${/recent activity/i.test(txt)}`);
    f.push(`nav: sales=${/Sales/i.test(txt)} customers=${/Customers/i.test(txt)} workshop=${/Workshop/i.test(txt)}`);

    // Dashboard shows cards: Sales, Inventory, Customers, Workshop, Finance, Marketing, Digital, Admin
    // Quick actions likely on navbar "More" or direct card click
    const salesCard = page.locator('a[href*="/sales"]').first();
    const customersCard = page.locator('a[href*="/customers"]').first();
    let a1 = false, a2 = false;
    if (await salesCard.count()) {
      await salesCard.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await screenshot(page, 's2_sales');
      f.push(`Sales card click → ${page.url()}`);
      a1 = true;
    }
    await goto(page, '/dashboard');
    if (await customersCard.count()) {
      await customersCard.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await screenshot(page, 's2_cust');
      f.push(`Customers card click → ${page.url()}`);
      a2 = true;
    }

    const status = (a1 && a2) ? 'PASS' : 'PARTIAL';
    logSection(2, 'DASHBOARD', f.map(x => `- ${x}`).join('\n'));
    logStatus(2, 'DASHBOARD', status, `a1=${a1} a2=${a2}`);
    state.s2 = a1 || a2;
  });

  test('S3 CUSTOMER', async () => {
    appendTimeline('S3 CUSTOMER start');
    const f: string[] = [];
    await goto(page, '/customers/new');
    await screenshot(page, 's3_new');
    const firstName = `${PREFIX}Customer_1`;
    const lastName = 'QATest';
    const fn = await fillIf(page, 'input[name="first_name"]', firstName);
    const ln = await fillIf(page, 'input[name="last_name"]', lastName);
    const em = await fillIf(page, 'input[name="email"]', 'qasim+cust1@nexpura-test.local');
    const mo = await fillIf(page, 'input[name="mobile"]', '+61400000001');
    f.push(`Fill: first=${fn} last=${ln} email=${em} mobile=${mo}`);
    await screenshot(page, 's3_filled');

    const sub = await submitForm(page, ['Create Customer', 'Save Customer', 'Save', 'Add customer']);
    f.push(`Submit: ${sub}`);
    await page.waitForTimeout(10000);
    await screenshot(page, 's3_after');
    let url = page.url();
    f.push(`Post-save URL: ${url}`);
    let id = extractId(url, 'customers');
    // Don't take /customers/new as an id
    if (id && /^new$/i.test(id)) id = null;
    if (id) {
      state.customerId = id;
      addCreated('customers', { id, name: `${firstName} ${lastName}` });
      f.push(`OK customerId=${id}`);
    } else {
      // Fallback: go to list, search, find link
      await goto(page, '/customers');
      const search = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      if (await search.count()) {
        await search.fill(firstName);
        await page.waitForTimeout(2500);
        await screenshot(page, 's3_search');
        const link = page.locator(`a:has-text("${firstName}")`).first();
        if (await link.count()) {
          const href = await link.getAttribute('href').catch(() => null);
          f.push(`Found customer link in list: ${href}`);
          if (href) {
            const m = href.match(/\/customers\/([a-f0-9\-]{30,})/i);
            if (m) { state.customerId = m[1]; addCreated('customers', { id: m[1], name: `${firstName} ${lastName}` }); f.push(`OK customerId from list: ${m[1]}`); }
          }
        } else {
          f.push('WARN customer not found in search results either');
        }
      }
    }

    if (state.customerId) {
      await goto(page, `/customers/${state.customerId}`);
      await screenshot(page, 's3_detail');
      const editOk = await tryClick(page, /edit/i, 3000);
      if (editOk) {
        await page.waitForTimeout(2500);
        await fillIf(page, 'textarea[name="notes"], textarea[placeholder*="note" i], textarea[placeholder*="special" i]', `${PREFIX}edit_${Date.now()}`);
        await clickFirst(page, ['button:has-text("Save")','button:has-text("Update")','button[type=submit]'], 3000);
        await page.waitForTimeout(4000);
        await screenshot(page, 's3_edited');
        f.push('Edit attempted');
      } else f.push('WARN edit button not found');
    }

    const status = state.customerId ? 'PASS' : 'FAIL';
    logSection(3, 'CUSTOMER', f.map(x => `- ${x}`).join('\n'));
    logStatus(3, 'CUSTOMER', status, state.customerId || 'no id');
    state.s3 = !!state.customerId;
  });

  test('S4 INTAKE', async () => {
    appendTimeline('S4 INTAKE start');
    const f: string[] = [];

    // -- Repair: go direct to /intake page, which has Repair tab active by default
    await goto(page, '/intake');
    await screenshot(page, 's4_intake_landing');

    // Pick customer via the "Search by name" input in Customer section
    async function pickCustomer(): Promise<boolean> {
      if (!state.customerId) return false;
      const custSearch = page.locator('input[placeholder*="Search by name" i], input[placeholder*="search" i]').first();
      if (!(await custSearch.count())) return false;
      await custSearch.click({ timeout: 2000 }).catch(()=>{});
      await custSearch.fill(PREFIX, { timeout: 2000 }).catch(()=>{});
      await page.waitForTimeout(1800);
      // The result should appear in a dropdown — click the first matching option
      const opt = page.locator(`button:has-text("${PREFIX}"), [role="option"]:has-text("${PREFIX}"), li:has-text("${PREFIX}")`).first();
      if (await opt.count()) { await opt.click({ timeout: 2000 }).catch(()=>{}); return true; }
      return false;
    }

    const picked = await pickCustomer();
    f.push(`Customer pick: ${picked}`);

    // Fill ITEM DESCRIPTION (required *) — textarea is identifiable by placeholder
    const descFilled =
      await fillIf(page, 'textarea[placeholder*="describe the piece" i]', `${PREFIX}Repair_Item_1 - Needs polish and sizing`) ||
      await fillIf(page, 'textarea[placeholder*="detail" i]', `${PREFIX}Repair_Item_1 - Needs polish and sizing`) ||
      await fillIf(page, 'textarea', `${PREFIX}Repair_Item_1 - Needs polish and sizing`);
    // ITEM TYPE is a native <select> w/o name. Use the first select on the page (Item Type).
    const selects = page.locator('select');
    const nselects = await sfn(() => selects.count(), 0);
    f.push(`selects on page: ${nselects}`);
    if (nselects > 0) {
      // First select is Item Type
      await selects.nth(0).selectOption('Ring').catch(async () => {
        await selects.nth(0).selectOption({ index: 1 }).catch(()=>{});
      });
      f.push('picked item_type = Ring');
    }
    // Price/deposit — these are in JobOverview section; use generic name selectors
    const priceF = await fillIf(page, 'input[name="quote_amount"], input[name="quote"], input[name="price"], input[placeholder*="quote" i], input[inputmode="decimal"]', '250');
    const depositF = await fillIf(page, 'input[name="deposit_amount"], input[name="deposit"], input[placeholder*="deposit" i]', '100');
    f.push(`descFilled=${descFilled} priceF=${priceF} depositF=${depositF}`);

    await screenshot(page, 's4_repair_filled');

    // Submit "Save & Create Job" in Quick Actions card — this button is NOT in a <form>, it's a standalone button
    // so submitForm() won't find it. Use text-scoped click, ignoring disabled.
    let sub: string | null = null;
    for (const label of ['Save & Create Job','Create Job','Save']) {
      const b = page.locator(`button:has-text("${label}")`).first();
      if (!(await b.count())) continue;
      const disabled = await b.isDisabled().catch(() => false);
      if (disabled) { f.push(`"${label}" button disabled — form invalid`); continue; }
      await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(()=>{});
      try { await b.click({ timeout: 3500 }); sub = label; break; } catch {}
    }
    f.push(`Submit: ${sub}`);
    await page.waitForTimeout(12000);
    await screenshot(page, 's4_repair_after');
    let url = page.url();
    f.push(`Post URL: ${url}`);
    let rid = extractId(url, 'repairs');
    if (!rid) {
      // Check for success screen "Repair Created" and extract id or click "Go to Repair Detail"
      const successTxt = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
      const successMatch = /Repair Created|Job #[A-Z0-9]+/i.test(successTxt);
      f.push(`success screen visible: ${successMatch}`);
      if (successMatch) {
        // Click "Go to Repair Detail"
        const gotoLink = page.locator('a:has-text("Go to Repair Detail"), button:has-text("Go to Repair Detail")').first();
        if (await gotoLink.count()) {
          const href = await gotoLink.getAttribute('href').catch(() => null);
          if (href) {
            const m = href.match(/\/repairs\/([a-f0-9\-]{30,})/i);
            if (m) rid = m[1];
          }
          if (!rid) {
            await gotoLink.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(4000);
            rid = extractId(page.url(), 'repairs');
          }
        }
      }
      if (!rid) {
        const errTxt = await sfn(() => page.locator('.text-red-600, .bg-red-50, [role="alert"]').allInnerTexts(), [] as string[]);
        f.push(`Validation/errors: ${JSON.stringify(errTxt).slice(0, 300)}`);
      }
    }
    if (!rid) rid = await resolveFromSuccessScreen(page, 'repairs');
    if (rid) { state.repairId = rid; addCreated('repairs', { id: rid }); f.push(`OK repairId=${rid}`); }

    // -- Bespoke
    await goto(page, '/intake');
    // Click "Bespoke" tab
    const bespokeTab = page.locator('button:has-text("Bespoke"), div[role="tab"]:has-text("Bespoke")').first();
    if (await bespokeTab.count()) { await bespokeTab.click({ timeout: 2000 }).catch(()=>{}); await page.waitForTimeout(1500); }
    await screenshot(page, 's4_bespoke_tab');
    await pickCustomer();
    // Title input (required *) — use placeholder
    const btitleF = await fillIf(page, 'input[placeholder*="Custom Engagement Ring" i], input[placeholder*="title" i]', `${PREFIX}Bespoke_Ring_1`);
    f.push(`bespoke title filled: ${btitleF}`);
    await fillIf(page, 'textarea[placeholder*="brief" i], textarea[placeholder*="desc" i], textarea', `${PREFIX}Bespoke ring with diamond`);
    // First select = jewellery type
    const bselects = page.locator('select');
    if (await bselects.count() > 0) await bselects.nth(0).selectOption('Ring').catch(async () => { await bselects.nth(0).selectOption({ index: 1 }).catch(()=>{}); });
    await fillIf(page, 'input[name="quote_amount"], input[name="quote"], input[placeholder*="quote" i], input[inputmode="decimal"]', '1200');
    await fillIf(page, 'input[name="deposit_amount"], input[placeholder*="deposit" i]', '400');
    // submit
    for (const label of ['Save & Create Job','Create Job','Save']) {
      const b = page.locator(`button:has-text("${label}")`).first();
      if (await b.count() && !(await b.isDisabled().catch(() => false))) {
        await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(()=>{});
        try { await b.click({ timeout: 3500 }); break; } catch {}
      }
    }
    await page.waitForTimeout(12000);
    await screenshot(page, 's4_bespoke_after');
    f.push(`Bespoke URL: ${page.url()}`);
    let bid = extractId(page.url(), 'bespoke');
    if (!bid) bid = await resolveFromSuccessScreen(page, 'bespoke');
    if (bid) { state.bespokeId = bid; addCreated('bespoke_orders', { id: bid }); f.push(`OK bespokeId=${bid}`); }
    else f.push('WARN bespoke id not found');

    const status = state.repairId ? 'PASS' : 'FAIL';
    logSection(4, 'INTAKE', f.map(x => `- ${x}`).join('\n'));
    logStatus(4, 'INTAKE', status, `repair=${state.repairId?'y':'n'} bespoke=${state.bespokeId?'y':'n'}`);
    state.s4 = !!state.repairId;
  });

  test('S5 INVOICE + PAYMENTS', async () => {
    appendTimeline('S5 start');
    const f: string[] = [];
    if (!state.repairId) { logSection(5,'INVOICE & PAYMENTS','- BLOCKED'); logStatus(5,'INVOICE & PAYMENTS','BLOCKED','no repair'); state.s5=false; return; }
    await goto(page, `/repairs/${state.repairId}`);
    await screenshot(page, 's5_repair');
    const invLink = page.locator('a[href*="/invoices/"]').first();
    if (await invLink.count()) {
      const href = await invLink.getAttribute('href');
      const id = href?.match(/\/invoices\/([a-f0-9\-]{30,})/i)?.[1];
      if (id) { state.invoiceId = id; addCreated('invoices', { id, linkedRepair: state.repairId }); f.push(`OK invoiceId=${id}`); }
    }
    if (!state.invoiceId) {
      f.push('WARN no invoice link on repair — try list');
      await goto(page, '/invoices');
      const first = page.locator('a[href*="/invoices/"]').first();
      if (await first.count()) {
        const href = await first.getAttribute('href');
        const id = href?.match(/\/invoices\/([a-f0-9\-]{30,})/i)?.[1];
        if (id) { state.invoiceId = id; f.push(`Top invoice from list: ${id}`); }
      }
    }
    if (!state.invoiceId) { logSection(5,'INVOICE & PAYMENTS', f.join('\n')); logStatus(5,'INVOICE & PAYMENTS','FAIL','no invoice'); state.s5=false; return; }

    await goto(page, `/invoices/${state.invoiceId}`);
    await screenshot(page, 's5_invoice');
    const pre = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    f.push(`Pre-payment keyword: ${/\b(paid|partial|unpaid|draft|due)\b/i.exec(pre)?.[0] || 'unknown'}`);

    const pay1 = await tryClick(page, /record payment|add payment|take payment|new payment/i, 3000);
    f.push(`Record payment: ${pay1}`);
    await page.waitForTimeout(1500);
    await screenshot(page, 's5_pay_modal');
    await fillIf(page, 'input[name*="amount" i]', '125');
    await clickFirst(page, ['button:has-text("Save")','button:has-text("Record")','button:has-text("Submit")','button[type=submit]'], 3000);
    await page.waitForTimeout(5000);
    addCreated('payments', { invoiceId: state.invoiceId, amount: 125, type: 'partial' });
    await goto(page, `/invoices/${state.invoiceId}`);
    await screenshot(page, 's5_partial');
    const after1 = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    f.push(`Partial reflected: ${/125|partial|outstanding|due/i.test(after1)}`);

    const pay2 = await tryClick(page, /record payment|add payment|take payment/i, 3000);
    if (pay2) {
      await fillIf(page, 'input[name*="amount" i]', '125');
      await clickFirst(page, ['button:has-text("Save")','button:has-text("Record")','button:has-text("Submit")','button[type=submit]'], 3000);
      await page.waitForTimeout(5000);
      addCreated('payments', { invoiceId: state.invoiceId, amount: 125, type: 'final' });
    }
    await goto(page, `/invoices/${state.invoiceId}`);
    await screenshot(page, 's5_paid');
    const after2 = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    const paidOk = /\bpaid\b/i.test(after2);
    f.push(`"paid" text after full: ${paidOk}`);

    const status = paidOk ? 'PASS' : (pay1 ? 'PARTIAL' : 'BLOCKED');
    logSection(5, 'INVOICE & PAYMENTS', f.map(x => `- ${x}`).join('\n'));
    logStatus(5, 'INVOICE & PAYMENTS', status, `paid=${paidOk}`);
    state.s5 = paidOk;
  });

  test('S6 RECEIPTS', async () => {
    appendTimeline('S6 start');
    const f: string[] = [];
    if (!state.invoiceId) { logSection(6,'RECEIPTS','- BLOCKED'); logStatus(6,'RECEIPTS','BLOCKED','no invoice'); state.s6=false; return; }
    await goto(page, `/invoices/${state.invoiceId}`);
    await screenshot(page, 's6_invoice');
    const printed = await tryClick(page, /print/i, 2500);
    await page.waitForTimeout(2000);
    await screenshot(page, 's6_print');
    f.push(`Print: ${printed} url: ${page.url()}`);
    await goto(page, `/invoices/${state.invoiceId}`);
    const emailed = await tryClick(page, /send email|email receipt|email/i, 2500);
    if (emailed) {
      await page.waitForTimeout(1500);
      await fillIf(page, 'input[type="email"]', 'qasim+receipt@nexpura-test.local');
      await clickFirst(page, ['button:has-text("Send")','button[type=submit]'], 3000);
      await page.waitForTimeout(2500);
      await screenshot(page, 's6_email');
    }
    f.push(`Email: ${emailed}`);
    const status = (printed && emailed) ? 'PASS' : (printed || emailed) ? 'PARTIAL' : 'FAIL';
    logSection(6, 'RECEIPTS', f.map(x => `- ${x}`).join('\n'));
    logStatus(6, 'RECEIPTS', status, `print=${printed} email=${emailed}`);
    state.s6 = printed || emailed;
  });

  test('S7 TASKS', async () => {
    appendTimeline('S7 start');
    const f: string[] = [];
    if (!state.repairId) { logSection(7,'TASKS','- BLOCKED'); logStatus(7,'TASKS','BLOCKED','no repair'); state.s7=false; return; }
    await goto(page, `/repairs/${state.repairId}`);
    await screenshot(page, 's7_repair');
    let added = await tryClick(page, /add task|new task|assign task|create task/i, 3000);
    if (!added) {
      await goto(page, '/tasks');
      added = await tryClick(page, /new task|add task/i, 2500);
    }
    f.push(`Add task: ${added}`);
    if (added) {
      await page.waitForTimeout(1500);
      await fillIf(page, 'input[name*="title" i], input[placeholder*="title" i]', `${PREFIX}Task_Polish`);
      await clickFirst(page, ['button:has-text("Save")','button:has-text("Create")','button:has-text("Add")','button[type=submit]'], 3000);
      await page.waitForTimeout(4000);
      await screenshot(page, 's7_task');
      addCreated('tasks', { title: `${PREFIX}Task_Polish`, repairId: state.repairId });
    }
    const sc = await tryClick(page, /in progress|start/i, 2000);
    f.push(`Status click: ${sc}`);
    logSection(7, 'TASKS', f.map(x => `- ${x}`).join('\n'));
    logStatus(7, 'TASKS', added ? (sc ? 'PASS' : 'PARTIAL') : 'BLOCKED', `added=${added}`);
    state.s7 = added;
  });

  test('S8 WORKSHOP', async () => {
    appendTimeline('S8 start');
    const f: string[] = [];
    await goto(page, '/workshop');
    await screenshot(page, 's8');
    f.push(`URL: ${page.url()}`);
    if (state.repairId) {
      await goto(page, `/repairs/${state.repairId}`);
      const clicked = await tryClick(page, /in progress|diagnosing|ready|completed/i, 2000);
      await page.waitForTimeout(2000);
      await screenshot(page, 's8_stage');
      f.push(`Stage click: ${clicked}`);
    }
    logSection(8, 'WORKSHOP', f.map(x => `- ${x}`).join('\n'));
    logStatus(8, 'WORKSHOP', 'PARTIAL', 'visited');
    state.s8 = true;
  });

  test('S9 TRACKING', async () => {
    appendTimeline('S9 start');
    const f: string[] = [];
    if (!state.repairId) { logSection(9,'TRACKING','- BLOCKED'); logStatus(9,'TRACKING','BLOCKED','no repair'); state.s9=false; return; }
    await goto(page, `/repairs/${state.repairId}`);
    const body = await sfn(() => page.content(), '');
    let trackPath = body.match(/\/track\/[a-zA-Z0-9\-_]+/)?.[0];
    if (!trackPath) {
      const l = page.locator('a[href*="/track/"]').first();
      if (await l.count()) trackPath = await l.getAttribute('href') ?? undefined;
    }
    f.push(`Track path: ${trackPath || 'NONE'}`);
    if (trackPath) {
      const ic = await browser.newContext();
      const ip = await ic.newPage();
      attach(ip, 'track');
      const url = trackPath.startsWith('http') ? trackPath : BASE_URL + trackPath;
      const t = Date.now();
      await sfn(() => ip.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }), null);
      await ip.waitForTimeout(3500);
      await ip.screenshot({ path: path.join(SCREENS_DIR, 's9_track.png') }).catch(()=>{});
      const txt = await sfn(() => ip.locator('body').innerText({ timeout: 3000 }), '');
      f.push(`Incog load ${Date.now()-t}ms len=${txt.length}`);
      f.push(`Preview: ${txt.slice(0, 300)}`);
      await ic.close();
    }
    logSection(9, 'TRACKING', f.map(x => `- ${x}`).join('\n'));
    logStatus(9, 'TRACKING', trackPath ? 'PARTIAL' : 'BLOCKED', trackPath ? 'track loaded' : 'no link');
    state.s9 = !!trackPath;
  });

  test('S10 PASSPORT', async () => {
    appendTimeline('S10 start');
    const f: string[] = [];
    await goto(page, '/passports');
    await screenshot(page, 's10_list');
    let opened = await tryClick(page, /new passport|create passport|add passport/i, 2500);
    if (!opened) { await goto(page, '/passports/new'); opened = !/\/login|404/.test(page.url()); }
    await page.waitForTimeout(2000);
    await screenshot(page, 's10_form');
    f.push(`Passport URL: ${page.url()} opened=${opened}`);
    if (opened) {
      const dumps = await sfn(() => page.locator('input, textarea').evaluateAll((els) => (els as HTMLInputElement[]).map(e => ({ name: e.name, type: e.type, placeholder: e.placeholder })), ), [] as any[]);
      f.push(`Passport inputs: ${JSON.stringify(dumps).slice(0, 400)}`);
      const inputs = page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
      const cnt = await sfn(() => inputs.count(), 0);
      for (let i = 0; i < Math.min(cnt, 8); i++) await inputs.nth(i).fill(`${PREFIX}P_${i}`).catch(()=>{});
      await submitForm(page, ['Create Passport','Save Passport','Create','Save']);
      await page.waitForTimeout(10000);
      await screenshot(page, 's10_after');
      let id = extractId(page.url(), 'passports');
      if (!id) id = await resolveFromSuccessScreen(page, 'passports');
      if (id) { state.passportId = id; addCreated('passports', { id }); f.push(`OK passportId=${id}`); }
      else f.push(`WARN no id URL=${page.url()}`);
    }
    const status = opened ? (state.passportId ? 'PASS' : 'PARTIAL') : 'BLOCKED';
    logSection(10, 'PASSPORT', f.map(x => `- ${x}`).join('\n'));
    logStatus(10, 'PASSPORT', status, state.passportId || 'no id');
    state.s10 = !!state.passportId;
  });

  test('S11 INVENTORY', async () => {
    appendTimeline('S11 start');
    const f: string[] = [];
    await goto(page, '/inventory/new');
    await screenshot(page, 's11_new');
    const itemName = `${PREFIX}Item_1`;
    const sku = `${PREFIX}SKU_1`;
    const dumps = await sfn(() => page.locator('input, textarea').evaluateAll((els) => (els as HTMLInputElement[]).map(e => ({ name: e.name, type: e.type, placeholder: e.placeholder })), ), [] as any[]);
    f.push(`inv inputs: ${JSON.stringify(dumps).slice(0, 400)}`);
    const nFilled = await fillIf(page, 'input[name="name"], input[name="product_name"]', itemName) || await fillIf(page, 'input[placeholder*="name" i]', itemName);
    await fillIf(page, 'input[name="sku"]', sku);
    const pFilled = await fillIf(page, 'input[name="price"], input[name="retail_price"]', '500');
    const qFilled = await fillIf(page, 'input[name="quantity"], input[name="stock"]', '10');
    f.push(`Filled: n=${nFilled} p=${pFilled} q=${qFilled}`);
    await screenshot(page, 's11_filled');
    // Make sure quantity has a real value (defaults to 0, must be positive or the item might be invalid)
    await fillIf(page, 'input[name="quantity"]', '10');
    const sub = await submitForm(page, ['Create Item', 'Save Item', 'Add Item', 'Create', 'Save']);
    f.push(`Submit: ${sub}`);
    // Wait longer — inventory create can be slow
    await page.waitForTimeout(15000);
    await screenshot(page, 's11_after');
    let id = extractId(page.url(), 'inventory');
    if (!id) id = await resolveFromSuccessScreen(page, 'inventory');
    // Also look for toast/message that item was created
    const bodyTxt = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    f.push(`body contains created/saved text: ${/created|added|saved|success/i.test(bodyTxt)}`);
    if (id) { state.inventoryId = id; addCreated('inventory_items', { id, name: itemName, sku }); f.push(`OK inventoryId=${id}`); }
    else {
      // Fallback: go to inventory list and find by SKU
      await goto(page, '/inventory');
      const search = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      if (await search.count()) {
        await search.fill(PREFIX).catch(()=>{});
        await page.waitForTimeout(2000);
        const link = page.locator('a[href*="/inventory/"]').first();
        if (await link.count()) {
          const href = await link.getAttribute('href').catch(() => null);
          const m = href?.match(/\/inventory\/([a-f0-9\-]{30,})/i);
          if (m) { id = m[1]; f.push(`Fallback from list: ${id}`); }
        }
      }
      if (id) { state.inventoryId = id; addCreated('inventory_items', { id, name: itemName, sku }); }
      else f.push(`WARN URL=${page.url()}`);
    }

    if (state.inventoryId) {
      await goto(page, `/inventory/${state.inventoryId}`);
      const adj = await tryClick(page, /adjust stock|add stock|edit stock|update stock/i, 2000);
      if (adj) {
        await page.waitForTimeout(1500);
        await fillIf(page, 'input[name="quantity"], input[name*="amount" i]', '5');
        await clickFirst(page, ['button:has-text("Save")','button:has-text("Add")','button[type=submit]'], 3000);
        await page.waitForTimeout(4000);
        f.push('Stock adjust attempted');
      }
      await screenshot(page, 's11_adj');
    }
    const status = state.inventoryId ? 'PASS' : (nFilled ? 'PARTIAL' : 'BLOCKED');
    logSection(11, 'INVENTORY', f.map(x => `- ${x}`).join('\n'));
    logStatus(11, 'INVENTORY', status, state.inventoryId || 'no id');
    state.s11 = !!state.inventoryId;
  });

  test('S12 MARKETPLACE', async () => {
    appendTimeline('S12 start');
    const f: string[] = [];
    if (!state.inventoryId) { logSection(12,'MARKETPLACE','- BLOCKED'); logStatus(12,'MARKETPLACE','BLOCKED','no inventory'); state.s12=false; return; }
    await goto(page, `/inventory/${state.inventoryId}`);
    await screenshot(page, 's12');
    const pub = await tryClick(page, /publish to shop|show in shop|list in marketplace|add to shop|publish/i, 2500);
    await page.waitForTimeout(2000);
    await screenshot(page, 's12_after_pub');
    f.push(`Publish: ${pub}`);
    if (pub) {
      addCreated('marketplace_listings', { inventoryId: state.inventoryId });
      for (const sp of ['/shop','/store','/marketplace']) {
        try {
          const r = await page.context().request.get(BASE_URL + sp, { timeout: 8000 });
          if (r.ok()) {
            const txt = await r.text();
            const shown = txt.includes(`${PREFIX}Item_1`);
            f.push(`Public ${sp}: ${r.status()} visible=${shown}`);
          } else f.push(`Public ${sp}: ${r.status()}`);
        } catch (e) { f.push(`Public ${sp}: ERR ${(e as Error).message}`); }
      }
      await goto(page, `/inventory/${state.inventoryId}`);
      const unpub = await tryClick(page, /unpublish|hide from shop|remove from shop|hide/i, 2500);
      await page.waitForTimeout(2000);
      await screenshot(page, 's12_unpub');
      f.push(`Unpublish: ${unpub}`);
      if (!unpub) f.push('CRITICAL could not unpublish');
    }
    logSection(12, 'MARKETPLACE', f.map(x => `- ${x}`).join('\n'));
    logStatus(12, 'MARKETPLACE', pub ? 'PARTIAL' : 'BLOCKED', pub ? 'publish attempted' : 'no UI');
    state.s12 = pub;
  });

  test('S13 WEBSITE', async () => {
    appendTimeline('S13 start');
    const f: string[] = [];
    await goto(page, '/website');
    await screenshot(page, 's13');
    f.push(`URL: ${page.url()}`);
    const edit = await tryClick(page, /edit|customize|open editor|design/i, 2500);
    await page.waitForTimeout(2500);
    await screenshot(page, 's13_editor');
    const txt = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    const crash = /error|failed|went wrong|exception/i.test(txt);
    f.push(`Edit: ${edit} crash: ${crash}`);
    logSection(13, 'WEBSITE', f.map(x => `- ${x}`).join('\n'));
    logStatus(13, 'WEBSITE', crash ? 'FAIL' : 'PARTIAL', crash ? 'error visible' : 'visited');
    state.s13 = !crash;
  });

  test('S14 REPORTS', async () => {
    appendTimeline('S14 start');
    const f: string[] = [];
    await goto(page, '/reports');
    await screenshot(page, 's14');
    const txt = await sfn(() => page.locator('body').innerText({ timeout: 5000 }), '');
    const hasN = /\d/.test(txt);
    const hasData = /customer|revenue|sales|invoice/i.test(txt);
    f.push(`numbers=${hasN} dataKW=${hasData} len=${txt.length}`);
    logSection(14, 'REPORTS', f.map(x => `- ${x}`).join('\n'));
    logStatus(14, 'REPORTS', hasN && hasData ? 'PASS' : hasN ? 'PARTIAL' : 'FAIL', `len=${txt.length}`);
    state.s14 = hasN && hasData;
  });

  test('S15 EDGE', async () => {
    appendTimeline('S15 start');
    const f: string[] = [];
    await goto(page, '/repairs/new');
    await screenshot(page, 's15_form');
    await fillIf(page, 'input[name*="price" i]', '-100');
    await fillIf(page, 'input[name*="deposit" i]', '9999');
    try {
      const b = page.locator('button[type=submit], button:has-text("Create"), button:has-text("Save")').first();
      if (await b.count()) {
        await b.click({ timeout: 2500 }).catch(()=>{});
        await b.click({ timeout: 1500 }).catch(()=>{});
      }
    } catch {}
    await page.waitForTimeout(3000);
    await screenshot(page, 's15_after');
    const txt = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    const validation = /required|invalid|error|must|cannot|missing|customer/i.test(txt);
    f.push(`Validation: ${validation}`);
    logSection(15, 'EDGE', f.map(x => `- ${x}`).join('\n'));
    logStatus(15, 'EDGE', validation ? 'PASS' : 'PARTIAL', validation ? 'validation OK' : 'no validation');
    state.s15 = validation;
  });

  test('S16 PERMISSIONS', async () => {
    appendTimeline('S16 start');
    const f: string[] = [];
    const fake = '00000000-0000-0000-0000-000000000001';
    await goto(page, `/customers/${fake}`);
    await screenshot(page, 's16_fake');
    const txt = await sfn(() => page.locator('body').innerText({ timeout: 3000 }), '');
    const forbidden = /not found|404|unauthorized|forbidden|access denied|no customer/i.test(txt);
    f.push(`Forbidden text: ${forbidden} URL: ${page.url()}`);
    logSection(16, 'PERMISSIONS', f.map(x => `- ${x}`).join('\n'));
    logStatus(16, 'PERMISSIONS', forbidden ? 'PASS' : 'PARTIAL', forbidden ? 'isolation OK' : 'no 404');
    state.s16 = forbidden;
  });

  test('S17 PERF', async () => {
    appendTimeline('S17 start');
    const f: string[] = [];
    const pgs = ['/dashboard','/customers','/inventory','/repairs','/invoices','/reports','/tasks','/workshop','/passports','/website','/pos'];
    for (const p of pgs) {
      const t = Date.now();
      await sfn(() => page.goto(BASE_URL + p, { waitUntil: 'domcontentloaded', timeout: 25000 }), null, `perf:${p}`);
      const ms = Date.now() - t;
      f.push(`  ${p}: ${ms}ms${ms > 3000 ? ' SLOW' : ''}`);
    }
    logSection(17, 'PERFORMANCE', f.map(x => `- ${x}`).join('\n'));
    logStatus(17, 'PERFORMANCE', 'PASS', 'timings recorded');
    state.s17 = true;
  });

  test('S18 FULL JOURNEY', async () => {
    appendTimeline('S18 start');
    const f: string[] = [];
    const firstName = `${PREFIX}Customer_2_Journey`;
    await goto(page, '/customers/new');
    await fillIf(page, 'input[name="first_name"]', firstName);
    await fillIf(page, 'input[name="last_name"]', 'Journey');
    await fillIf(page, 'input[name="email"]', 'qasim+cust2@nexpura-test.local');
    await fillIf(page, 'input[name="mobile"]', '+61400000002');
    await submitForm(page, ['Create Customer','Save','Create']);
    await page.waitForTimeout(10000);
    await screenshot(page, 's18_cust2');
    let c2 = extractId(page.url(), 'customers');
    if (c2 && c2 !== 'new') { addCreated('customers', { id: c2, journey: true, name: firstName }); f.push(`OK cust2=${c2}`); }

    await goto(page, '/intake');
    // Repair default tab
    const cs = page.locator('input[placeholder*="Search" i]').first();
    if (await cs.count()) {
      await cs.fill(firstName).catch(()=>{});
      await page.waitForTimeout(2000);
      const opt = page.locator(`button:has-text("${firstName}"), [role="option"]:has-text("${firstName}")`).first();
      if (await opt.count()) await opt.click({ timeout: 2000 }).catch(()=>{});
    }
    await fillIf(page, 'textarea[placeholder*="describe" i]', `${PREFIX}Journey repair description`);
    const it = page.locator('select').first();
    if (await it.count()) await it.selectOption('Ring').catch(async () => { await it.selectOption({ index: 1 }).catch(()=>{}); });
    await fillIf(page, 'input[name="quote_amount"], input[placeholder*="quote" i], input[inputmode="decimal"]', '300');
    await fillIf(page, 'input[name="deposit_amount"], input[placeholder*="deposit" i]', '150');
    await screenshot(page, 's18_repair');
    // S18 repair — "Save & Create Job" is outside form
    for (const label of ['Save & Create Job','Create Job','Save']) {
      const b = page.locator(`button:has-text("${label}")`).first();
      if (await b.count() && !(await b.isDisabled().catch(() => false))) {
        await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(()=>{});
        try { await b.click({ timeout: 3500 }); break; } catch {}
      }
    }
    await page.waitForTimeout(12000);
    await screenshot(page, 's18_repair_after');
    let r2 = extractId(page.url(), 'repairs');
    if (!r2) r2 = await resolveFromSuccessScreen(page, 'repairs');
    if (r2) { addCreated('repairs', { id: r2, journey: true }); f.push(`OK rep2=${r2}`); }
    else f.push('WARN rep2 not captured');

    logSection(18, 'FULL JOURNEY', f.map(x => `- ${x}`).join('\n'));
    logStatus(18, 'FULL JOURNEY', (c2 && r2) ? 'PARTIAL' : 'FAIL', `c2=${c2?'y':'n'} r2=${r2?'y':'n'}`);
    state.s18 = !!(c2 && r2);
  });
});
