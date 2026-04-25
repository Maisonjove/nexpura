/**
 * Jeweller real-flow #3 — repair intake.
 *
 * Pre-seeds a customer, opens /repairs/new, picks the customer, fills
 * the repair details, submits, and verifies the repair landed in the
 * DB with the expected fields.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   SUPABASE_PAT=... \
 *   pnpm exec playwright test e2e/jeweller-flow-repair.spec.ts
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://nexpura-delta.vercel.app";
const EMAIL = process.env.NEXPURA_TEST_EMAIL;
const PASSWORD = process.env.NEXPURA_TEST_PASSWORD;
const SUPABASE_PROJECT_REF = "vkpjocnrefjfpuovzinn";
const SUPABASE_PAT = process.env.SUPABASE_PAT;
const TEST_TENANT_SLUG = "test-4-psd98";
const TEST_TENANT_ID = "25841dae-5124-4206-8c55-d05fd4e28d3c";

async function runDbQuery<T = unknown>(sql: string): Promise<T> {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!r.ok) throw new Error(`DB query failed: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function seedCustomer(): Promise<{ id: string; name: string }> {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const name = `QA Repair Customer ${stamp}`;
  const sql = `
    INSERT INTO customers (tenant_id, full_name, first_name, last_name, email, phone)
    VALUES ('${TEST_TENANT_ID}'::uuid, '${name}', 'QA', 'Repair', 'qa+repair-${stamp}@example.test', '0400000000')
    RETURNING id, full_name AS name
  `;
  const rows = await runDbQuery<Array<{ id: string; name: string }>>(sql);
  return rows[0];
}

test.describe("Repair intake flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.skip(!SUPABASE_PAT, "set SUPABASE_PAT for customer seeding");
  test.setTimeout(5 * 60 * 1000);

  test("create repair → verify persisted", async ({ browser }) => {
    const customer = await seedCustomer();

    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);

    // ── Pick a specific location via the LocationPicker UI ────────────
    // (Repairs / POS / Sales etc. all reject the "All Locations" view.)
    // The UI flow calls setSelectedLocation which sets the cookie
    // server-side AND revalidates the data cache.
    await page.goto(`/${TEST_TENANT_SLUG}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await pickFirstLocation(page);

    // ── Open new-repair form ──────────────────────────────────────────
    await page.goto(`/${TEST_TENANT_SLUG}/repairs/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // ── Pick the seeded customer ─────────────────────────────────────
    const customerSearch = page.getByPlaceholder(/Search customers/i).first();
    await expect(customerSearch).toBeVisible({ timeout: 10_000 });
    await customerSearch.fill(customer.name);
    await page.waitForTimeout(800);
    // Click the matching customer in the dropdown
    await page.getByText(customer.name).first().click();
    await page.waitForTimeout(500);

    // ── Fill the repair fields ───────────────────────────────────────
    const stamp = Date.now().toString(36);
    const desc = `QA test repair ${stamp}`;
    // Required selects — pick the first non-empty option
    await page.locator('select[name="item_type"]').first().selectOption({ index: 1 });
    await page.locator('select[name="repair_type"]').first().selectOption({ index: 1 });
    await page.locator('textarea[name="item_description"], input[name="item_description"]').first().fill(desc);
    await page.locator('textarea[name="work_description"], input[name="work_description"]').first().fill(`Resize ring + polish ${stamp}`);
    await page.locator('input[name="quoted_price"]').first().fill("250");

    // ── Submit ───────────────────────────────────────────────────────
    const submitBtn = page.getByRole("button", { name: /^(Create|Save|Submit|Add Repair)/i }).first();
    await expect(submitBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (r) => /\/repairs/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await submitBtn.click();
    const response = await responsePromise;
    if (response) expect(response.status(), `POST /repairs response: ${response.status()}`).toBeLessThan(500);

    // Should redirect to /repairs/[id] after create
    await page.waitForURL(/\/repairs\/[a-f0-9-]{36}/, { timeout: 30_000 });
    const repairId = page.url().match(/\/repairs\/([a-f0-9-]{36})/)?.[1] ?? "";
    expect(repairId).toMatch(/^[a-f0-9-]{36}$/);

    // ── Verify in DB ─────────────────────────────────────────────────
    const rows = await runDbQuery<Array<{
      id: string;
      item_description: string;
      customer_id: string;
      stage: string;
      quoted_price: string;
    }>>(
      `SELECT id, item_description, customer_id, stage, quoted_price::numeric AS quoted_price
       FROM repairs WHERE id = '${repairId}'::uuid`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].item_description).toContain(desc);
    expect(rows[0].customer_id).toBe(customer.id);
    expect(Number(rows[0].quoted_price)).toBe(250);
    expect(rows[0].stage).toBeTruthy();

    await ctx.close();
  });
});

async function pickFirstLocation(page: Page): Promise<void> {
  // Drive the actual LocationPicker UI — clicks the "All Locations"
  // pill in the header to open the dropdown, then clicks the first
  // specific-location card. This calls the setSelectedLocation server
  // action which writes the cookie + revalidates the data cache. Doing
  // it via Playwright addCookies() is NOT sufficient: the server reads
  // the cookie correctly for SSR (header updates) but resolveLocation-
  // ForCreate during the form-submit somehow doesn't see it. Going
  // through the real UI flow side-steps the discrepancy.
  const picker = page.locator("button", { hasText: "All Locations" }).first();
  if (await picker.count() === 0) return; // already on a specific location
  await picker.click();
  await page.waitForTimeout(600);
  // The dropdown contains buttons whose visible text starts with the
  // location name; "test 4 - Main Storeretail" combines name + type.
  const target = page.locator("button", { hasText: /test 4 - Main Store/i }).first();
  await target.click();
  await page.waitForTimeout(1500);
}

async function login(page: Page): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(EMAIL!);
  await page.getByLabel(/password/i).first().fill(PASSWORD!);
  await page.getByRole("button", { name: /^(sign in|log in|continue)/i }).click();
  await page.waitForURL(/\/[a-z0-9-]+\/(dashboard|verify-2fa|onboarding)/, { timeout: 30_000 });
  if (page.url().includes("/verify-2fa")) {
    throw new Error("Test account has 2FA — disable for QA or use a non-2FA account");
  }
}
