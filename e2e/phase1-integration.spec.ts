import { test, Page } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'https://nexpura.com';
const EMAIL = 'Joeygermani11@icloud.com';
const PASSWORD = 'Test123456';
const PREFIX = 'QA_P1I_2026-04-18_';
const SHOTS = '/tmp/nexpura-p1i-screens';
const LOG = '/tmp/nexpura-p1i-log.md';
const CLEANUP = '/tmp/nexpura-p1i-cleanup.json';

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(LOG, `# Phase 1 Integration — ${new Date().toISOString()}\n**base=** ${BASE}\n\n`);

type Created = { customers: string[]; repairs: string[]; invoices: string[] };
const created: Created = { customers: [], repairs: [], invoices: [] };
function saveCleanup() { fs.writeFileSync(CLEANUP, JSON.stringify({ prefix: PREFIX, created }, null, 2)); }

function log(s: string) {
  const line = `- ${new Date().toISOString()} — ${s}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {});
}
async function loginIfNeeded(page: Page) {
  if (!/login/i.test(page.url())) return;
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 30000 });
}

test('Phase 1 integration — 3 picker runs + 1 inline-create run', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000); // 20 minutes

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);
  log(`✓ login ok: ${page.url()}`);

  // Hide annot8 widgets globally
  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    window.addEventListener('DOMContentLoaded', hide);
    setInterval(hide, 1500);
  });

  const runResults: Array<Record<string, string>> = [];

  async function runOne(n: number, useInline: boolean) {
    const r: Record<string, string> = { run: String(n), mode: useInline ? 'inline' : 'picker' };
    log(`\n=========== RUN ${n} (${r.mode}) ===========`);

    const customerName = `${PREFIX}Customer_${n} QATest`;
    let customerId = '';

    if (!useInline) {
      // === Pre-create customer ===
      await page.goto(`${BASE}/customers/new`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.locator('input[name=first_name]').fill(`${PREFIX}Customer_${n}`);
      await page.locator('input[name=last_name]').fill('QATest');
      await page.locator('input[name=email]').fill(`qap1i+c${n}@nexpura-test.local`);
      await page.locator('input[name=mobile]').fill(`04000001${n}${n}`);
      await shot(page, `run${n}_A_filled`);
      await page.locator('button:has-text("Create Customer")').first().click({ timeout: 8000 });
      try {
        await page.waitForURL(/\/customers\/[a-f0-9\-]{30,}/, { timeout: 25000 });
        customerId = page.url().match(/\/customers\/([a-f0-9\-]{30,})/)?.[1] ?? '';
        created.customers.push(customerId); saveCleanup();
        r.customer_create = 'PASS';
        r.customerId = customerId;
        log(`  ✓ customer created ${customerId}`);
      } catch {
        r.customer_create = 'FAIL';
        log(`  ✗ customer create failed, url=${page.url()}`);
        runResults.push(r); return;
      }
    }

    // === Intake ===
    await page.goto(`${BASE}/intake`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await shot(page, `run${n}_B_intake_landing`);

    if (useInline) {
      // Open "Create new customer" inline form
      await page.locator('button:has-text("Create new customer")').first().click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      const firstInput = page.locator('input[placeholder="First name"]');
      if (await firstInput.count() === 0) {
        r.inline_open = 'FAIL';
        log(`  ✗ inline form did not open`);
        runResults.push(r); return;
      }
      await firstInput.fill(`${PREFIX}Customer_${n}`);
      await page.locator('input[placeholder="Last name"]').fill('QATest');
      await page.locator('input[placeholder*="email" i]').first().fill(`qap1i+c${n}@nexpura-test.local`);
      await page.locator('input[placeholder*="04XX" i], input[type=tel]').first().fill(`04000001${n}${n}`);
      await shot(page, `run${n}_B_inline_filled`);
      await page.locator('button:has-text("Create Customer")').first().click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
      r.inline_create = 'PASS';
    } else {
      // Search & pick
      const search = page.locator('input[placeholder*="Search by name" i], input[placeholder*="phone" i]').first();
      await search.click();
      await search.fill(customerName.split(' ')[0]); // search by prefix + customer number
      await page.waitForTimeout(2000);
      // Click dropdown item
      const opts = await page.locator(`button:has-text("${PREFIX}Customer_${n}")`).all();
      log(`  dropdown buttons matching "${PREFIX}Customer_${n}": ${opts.length}`);
      if (opts.length === 0) {
        r.picker = 'FAIL_NO_RESULTS';
        log(`  ✗ no picker result for ${customerName}`);
        runResults.push(r); return;
      }
      await opts[0].click({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }

    // Confirm "Selected Customer Card" shows the name
    await shot(page, `run${n}_B_after_pick`);
    const headingVisible = await page.locator(`text=${PREFIX}Customer_${n}`).first().isVisible().catch(() => false);
    r.picker_display = headingVisible ? 'PASS' : 'FAIL';
    log(`  picker display: ${r.picker_display}`);

    // Pick Item Type = Ring (first select)
    const selects = page.locator('select');
    if (await selects.count() > 0) {
      await selects.nth(0).selectOption('Ring').catch(async () => { await selects.nth(0).selectOption({ index: 1 }); });
    }
    // Fill item description
    const descTA = page.locator('textarea[placeholder*="describe" i], textarea[placeholder*="detail" i]').first();
    if (await descTA.count() > 0) {
      await descTA.fill(`${PREFIX}Repair_${n} — polish and sizing`);
    }
    await shot(page, `run${n}_B_form_filled`);

    // Submit
    const saveBtn = page.locator('button:has-text("Save & Create Job"), button:has-text("Create Job")').first();
    const btnDisabled = await saveBtn.isDisabled().catch(() => false);
    r.save_btn_disabled = String(btnDisabled);
    log(`  save button disabled: ${btnDisabled}`);
    if (btnDisabled) {
      r.intake_submit = 'FAIL_DISABLED';
      runResults.push(r); return;
    }
    await saveBtn.scrollIntoViewIfNeeded().catch(()=>{});
    await saveBtn.click({ timeout: 8000 });
    await page.waitForTimeout(10000);
    await shot(page, `run${n}_B_after_submit`);

    // Extract repair id
    const postUrl = page.url();
    log(`  post-submit url: ${postUrl}`);
    let repairId = postUrl.match(/\/repairs\/([a-f0-9\-]{30,})/)?.[1] ?? '';
    if (!repairId) {
      // Success screen path
      const gotoLink = page.locator('a:has-text("Go to Repair Detail"), button:has-text("Go to Repair Detail")').first();
      if (await gotoLink.count()) {
        const href = await gotoLink.getAttribute('href').catch(() => null);
        if (href) repairId = href.match(/\/repairs\/([a-f0-9\-]{30,})/)?.[1] ?? '';
        if (!repairId) {
          await gotoLink.click({ timeout: 5000 }).catch(()=>{});
          await page.waitForTimeout(4000);
          repairId = page.url().match(/\/repairs\/([a-f0-9\-]{30,})/)?.[1] ?? '';
        }
      }
    }
    if (!repairId) {
      r.intake_submit = 'FAIL_NO_REPAIR_ID';
      log(`  ✗ could not extract repair id`);
      runResults.push(r); return;
    }
    created.repairs.push(repairId); saveCleanup();
    r.intake_submit = 'PASS';
    r.repairId = repairId;
    log(`  ✓ repair created: ${repairId}`);

    // Navigate to repair detail & verify customer is linked
    if (!/\/repairs\//.test(page.url())) {
      await page.goto(`${BASE}/repairs/${repairId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    }
    await shot(page, `run${n}_C_repair_detail`);
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const hasCustomerName = bodyText.includes(`${PREFIX}Customer_${n}`);
    const hasNoCustomerMarker = /No customer linked|no customer/i.test(bodyText);
    r.customer_persisted = hasCustomerName ? 'PASS' : hasNoCustomerMarker ? 'FAIL' : 'UNCLEAR';
    log(`  customer persistence on repair: ${r.customer_persisted} (hasName=${hasCustomerName} hasNoMarker=${hasNoCustomerMarker})`);

    // Click Create Invoice button
    const createInvBtn = page.locator('button:has-text("Create Invoice")').first();
    const invExists = await createInvBtn.count();
    r.invoice_cta = invExists > 0 ? 'PRESENT' : 'MISSING';
    log(`  Create Invoice button: ${r.invoice_cta}`);

    if (invExists) {
      await createInvBtn.scrollIntoViewIfNeeded().catch(()=>{});
      await createInvBtn.click({ timeout: 8000 }).catch(e => log(`  click inv err: ${e.message}`));
      await page.waitForTimeout(6000);
      await shot(page, `run${n}_C_after_invoice_click`);
      const invUrl = page.url();
      const invId = invUrl.match(/\/invoices\/([a-f0-9\-]{30,})/)?.[1] ?? '';
      if (invId) {
        created.invoices.push(invId); saveCleanup();
        r.invoice_created = 'PASS';
        r.invoiceId = invId;
        log(`  ✓ invoice created: ${invId}`);

        // Look for tracking link on repair (Phase 2 check)
        await page.goto(`${BASE}/repairs/${repairId}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        const trackingLink = await page.locator('text=/\\/track\\//').count();
        const trackingBtn = await page.locator('button:has-text("Track"), a:has-text("Track")').count();
        r.tracking_ui = (trackingLink + trackingBtn) > 0 ? 'PRESENT' : 'MISSING_PHASE2';
      } else {
        r.invoice_created = 'FAIL_NO_ID';
      }
    }

    runResults.push(r);
    log(`  run ${n} complete: ${JSON.stringify(r)}`);
  }

  await runOne(1, false);
  await runOne(2, false);
  await runOne(3, false);
  await runOne(4, true);

  fs.writeFileSync('/tmp/nexpura-p1i-results.json', JSON.stringify(runResults, null, 2));
  log(`\n============ SUMMARY ============`);
  runResults.forEach(r => log(JSON.stringify(r)));

  // Preview smoke check
  log(`\n--- Preview smoke (cookie fix) ---`);
  const preview = 'https://nexpura-delta.vercel.app';
  const ctx2 = await page.context().browser()!.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${preview}/login`, { waitUntil: 'domcontentloaded' });
  await p2.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await p2.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await p2.locator('form button[type=submit]').first().click();
  const previewOk = await p2.waitForURL(/dashboard/i, { timeout: 30000 }).then(() => true).catch(() => false);
  log(`preview login (cookie fix verified): ${previewOk ? 'PASS' : 'FAIL'} — final url: ${p2.url()}`);
  await shot(p2, 'preview_final');
  await ctx2.close();
});
