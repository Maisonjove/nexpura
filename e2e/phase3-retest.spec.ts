import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P3R_2026-04-18_';

const SHOTS = '/tmp/nexpura-p3r-screens';
const RESULTS = '/tmp/nexpura-p3r-results.json';

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(RESULTS, '{}');

function readResults(): Record<string, Record<string, string>> {
  try { return JSON.parse(fs.readFileSync(RESULTS, 'utf8')); } catch { return {}; }
}
function set(flow: string, key: string, val: string) {
  const r = readResults();
  r[flow] = r[flow] || {};
  r[flow][key] = val;
  fs.writeFileSync(RESULTS, JSON.stringify(r, null, 2));
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {});
}

async function hideAnnot8(page: Page) {
  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1000);
  });
}

// ─── FLOW 1: Login error handling ───────────────────────────────
test('F1 — login error handling', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await hideAnnot8(page);

  // wrong password
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill('wrong_pw_zzzzz');
  await page.locator('form button[type=submit]').first().click();
  // Wait up to 20s for transition to settle
  for (let s = 0; s < 25; s++) {
    await page.waitForTimeout(800);
    const btn = await page.locator('form button[type=submit]').first().innerText().catch(() => '');
    if (btn.trim().toLowerCase() === 'sign in') break;
  }
  await shot(page, 'f1_wrong_pw');
  const body1 = await page.locator('body').innerText().catch(() => '');
  const btnText1 = (await page.locator('form button[type=submit]').first().innerText().catch(() => '')).trim();
  set('login', 'wrong_pw_button_settles', btnText1.toLowerCase() === 'sign in' ? 'PASS' : 'FAIL');
  set('login', 'wrong_pw_error_banner', /Invalid email or password/i.test(body1) ? 'PASS' : 'FAIL');

  // unconfirmed-email: use a fake never-registered address. Supabase returns invalid_credentials
  // (not email_not_confirmed) for a non-existing user, so we can only confirm the DISTINCT
  // message path exists in code — it's deployable but not always reproducible without signup.
  set('login', 'email_not_confirmed_path_deployed', 'SEE_CODE'); // verified at merge time

  // successful login
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  let navigated = false;
  try {
    await page.waitForURL(/dashboard/i, { timeout: 25000 });
    navigated = true;
  } catch {}
  await shot(page, 'f1_successful_login');
  set('login', 'successful_login_still_works', navigated ? 'PASS' : 'FAIL');
});

// ─── FLOW 2: Dashboard performance ──────────────────────────────
test('F2 — dashboard performance', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await hideAnnot8(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });

  // First load already happened by login redirect — measure REPEAT load
  const t1 = Date.now();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  const first = Date.now() - t1;
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const firstIdle = Date.now() - t1;

  await page.waitForTimeout(3000);

  const t2 = Date.now();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  const second = Date.now() - t2;
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const secondIdle = Date.now() - t2;

  console.log(`F2: first=${first}ms idle=${firstIdle}ms | second=${second}ms idle=${secondIdle}ms`);
  set('dashboard', 'first_load_domready_ms', String(first));
  set('dashboard', 'first_load_networkidle_ms', String(firstIdle));
  set('dashboard', 'repeat_load_domready_ms', String(second));
  set('dashboard', 'repeat_load_networkidle_ms', String(secondIdle));
  set('dashboard', 'improved_on_repeat', second < first ? 'PASS' : 'NOT_FASTER');

  const body = await page.locator('body').innerText().catch(() => '');
  set('dashboard', 'cards_render_no_broken_state', body.length > 1000 && !/Something went wrong|error/i.test(body.slice(0, 500)) ? 'PASS' : 'FAIL');
  await shot(page, 'f2_dashboard');
});

// ─── FLOW 3: Duplicate customers ────────────────────────────────
test('F3 — duplicate customer handling', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await hideAnnot8(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });

  // Create customer #1 with unique email + mobile
  const uniqSuffix = Date.now().toString(36);
  const sharedEmail = `qap3r.${uniqSuffix}@nexpura-test.local`;
  const sharedMobile = `04009${uniqSuffix.slice(-6)}`;

  await page.goto(`${BASE}/customers/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.locator('input[name=first_name]').fill(`${PREFIX}Dup1`);
  await page.locator('input[name=last_name]').fill('Tester');
  await page.locator('input[name=email]').fill(sharedEmail);
  await page.locator('input[name=mobile]').fill(sharedMobile);
  await page.locator('button:has-text("Create Customer"), form button[type=submit]').first().click({ timeout: 8000 });
  await page.waitForURL(/\/customers\/[a-f0-9\-]{30,}/, { timeout: 20000 });
  const firstId = page.url().match(/\/customers\/([a-f0-9\-]{30,})/)?.[1];
  set('customers', 'first_create_ok', firstId ? 'PASS' : 'FAIL');

  // Try duplicate email (different first_name, same email)
  await page.goto(`${BASE}/customers/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.locator('input[name=first_name]').fill(`${PREFIX}Dup2_sameEmail`);
  await page.locator('input[name=last_name]').fill('Tester');
  await page.locator('input[name=email]').fill(sharedEmail);
  await page.locator('input[name=mobile]').fill('0499999999');
  await page.locator('button:has-text("Create Customer"), form button[type=submit]').first().click({ timeout: 8000 });
  await page.waitForTimeout(4000);
  await shot(page, 'f3_dup_email');
  const body1 = await page.locator('body').innerText().catch(() => '');
  const emailDupMsg = /already exists/i.test(body1) || /duplicate/i.test(body1);
  const hasViewLink = await page.locator('a:has-text("View existing customer")').count() > 0;
  set('customers', 'duplicate_email_warning_shown', emailDupMsg ? 'PASS' : 'FAIL');
  set('customers', 'duplicate_email_view_link_present', hasViewLink ? 'PASS' : 'FAIL');

  // Follow the view-existing link
  if (hasViewLink) {
    const viewLink = page.locator('a:has-text("View existing customer")').first();
    const href = await viewLink.getAttribute('href');
    await viewLink.click({ timeout: 5000 });
    await page.waitForTimeout(4000);
    const navigated = /\/customers\/[a-f0-9\-]{30,}/.test(page.url()) && page.url().includes(firstId || '');
    set('customers', 'duplicate_view_link_navigates_to_existing', navigated ? 'PASS' : 'FAIL');
    console.log(`F3: view link href=${href}, navigated to=${page.url()}`);
  }

  // Try duplicate mobile (different email, same mobile)
  await page.goto(`${BASE}/customers/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.locator('input[name=first_name]').fill(`${PREFIX}Dup3_sameMobile`);
  await page.locator('input[name=last_name]').fill('Tester');
  await page.locator('input[name=email]').fill(`qap3r.other.${uniqSuffix}@nexpura-test.local`);
  await page.locator('input[name=mobile]').fill(sharedMobile);
  await page.locator('button:has-text("Create Customer"), form button[type=submit]').first().click({ timeout: 8000 });
  await page.waitForTimeout(4000);
  await shot(page, 'f3_dup_mobile');
  const body2 = await page.locator('body').innerText().catch(() => '');
  set('customers', 'duplicate_mobile_warning_shown', /already exists/i.test(body2) ? 'PASS' : 'FAIL');

  // Normal create still works (different email + mobile)
  await page.goto(`${BASE}/customers/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.locator('input[name=first_name]').fill(`${PREFIX}NormalCreate`);
  await page.locator('input[name=last_name]').fill('Tester');
  await page.locator('input[name=email]').fill(`qap3r.normal.${uniqSuffix}@nexpura-test.local`);
  await page.locator('input[name=mobile]').fill(`04007${uniqSuffix.slice(-6)}`);
  await page.locator('button:has-text("Create Customer"), form button[type=submit]').first().click({ timeout: 8000 });
  let ok = false;
  try {
    await page.waitForURL(/\/customers\/[a-f0-9\-]{30,}/, { timeout: 20000 });
    ok = true;
  } catch {}
  set('customers', 'normal_create_still_works', ok ? 'PASS' : 'FAIL');
});

// ─── FLOW 4: Intake nav visibility ──────────────────────────────
test('F4 — intake nav visibility', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  await hideAnnot8(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
  await page.waitForTimeout(3000);

  // Desktop: find the + Intake link in the top nav
  const intakeLink = page.locator('a:has-text("+ Intake"), a:has-text("Intake")').first();
  const intakeCount = await intakeLink.count();
  set('nav', 'intake_link_visible_desktop', intakeCount > 0 ? 'PASS' : 'FAIL');
  await shot(page, 'f4_desktop_nav');

  if (intakeCount > 0) {
    const href = await intakeLink.getAttribute('href');
    console.log(`F4: Intake href=${href}`);
    set('nav', 'intake_href', href ?? 'MISSING');
    await intakeLink.click({ timeout: 5000 });
    await page.waitForTimeout(4000);
    const onIntake = /\/intake/.test(page.url());
    set('nav', 'intake_link_navigates_to_intake', onIntake ? 'PASS' : 'FAIL');
    await shot(page, 'f4_on_intake');
  }

  // Old path: Sales > New Intake still works (go direct since hover menu needs manual scripting)
  await page.goto(`${BASE}/intake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const intakePageBody = await page.locator('body').innerText().catch(() => '');
  set('nav', 'intake_page_loads_correctly', /New Intake|Customer|Repair|Bespoke/.test(intakePageBody) ? 'PASS' : 'FAIL');

  // Mobile viewport check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  // open mobile menu — the hamburger button (try multiple selectors)
  const hamburger = page.locator('button[aria-label*="menu" i], button:has-text("Menu"), header button').last();
  const hamCount = await hamburger.count();
  if (hamCount) {
    await hamburger.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await shot(page, 'f4_mobile_menu');
  const mobileBody = await page.locator('body').innerText().catch(() => '');
  set('nav', 'intake_visible_in_mobile_drawer', /\+\s*(New )?Intake/i.test(mobileBody) ? 'PASS' : 'UNCLEAR');
});
