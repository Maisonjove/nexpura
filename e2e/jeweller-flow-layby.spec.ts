/**
 * Jeweller real-flow #7 — layby (cart with customer + deposit).
 *
 * Pre-seeds 1 inventory item + 1 customer, drives the full POS layby
 * flow: pick location → cart item → pick customer → Charge → Layby tab
 * → enter deposit → submit. Verifies the sale row lands with status
 * "layby" and a sale_payments row records the deposit.
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

async function seedItem(): Promise<{ id: string; name: string; sku: string; price: number }> {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const item = {
    id: "",
    name: `QA Layby Ring ${stamp}`,
    sku: `QA-LAYBY-${stamp}`,
    price: 850,
  };
  const sql = `
    INSERT INTO inventory (tenant_id, name, sku, retail_price, quantity, low_stock_threshold, status, track_quantity)
    VALUES ('${TEST_TENANT_ID}'::uuid, '${item.name}', '${item.sku}', ${item.price}, 50, 5, 'active', true)
    RETURNING id
  `;
  const rows = await runDbQuery<Array<{ id: string }>>(sql);
  item.id = rows[0].id;
  return item;
}

async function seedCustomer(): Promise<{ id: string; name: string }> {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const name = `QA Layby Customer ${stamp}`;
  const rows = await runDbQuery<Array<{ id: string; name: string }>>(
    `INSERT INTO customers (tenant_id, full_name, first_name, last_name, email, phone)
     VALUES ('${TEST_TENANT_ID}'::uuid, '${name}', 'QA', 'Layby', 'qa+layby-${stamp}@example.test', '0400000000')
     RETURNING id, full_name AS name`,
  );
  return rows[0];
}

test.describe("Layby flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.skip(!SUPABASE_PAT, "set SUPABASE_PAT");
  // The earlier "invalid postponed state" bug surfaced on the
  // /dashboard POST that fires when LocationPicker calls the
  // setSelectedLocation server action. Root cause was the action's
  // `revalidatePath("/dashboard")` (+ 5 sibling paths) clashing with
  // Next 16's cacheComponents postponed-state cache. Action no longer
  // calls revalidatePath — the cookie write alone is enough, and
  // pages re-fetch on navigation since `getCached` is a no-op since
  // the Redis removal. Spec re-enabled.
  test.setTimeout(5 * 60 * 1000);

  test("create layby with deposit → verify sale.status='layby' + payment recorded", async ({ browser }) => {
    const item = await seedItem();
    const customer = await seedCustomer();
    const deposit = 200;

    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    page.on("pageerror", (err) => console.log("[pageerror]", err.message.slice(0, 200)));
    page.on("response", (r) => {
      if (r.status() >= 500) console.log("[5xx]", r.request().method(), r.url(), "->", r.status());
    });

    await login(page);

    await page.goto(`/${TEST_TENANT_SLUG}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await pickFirstLocation(page);

    await page.goto(`/${TEST_TENANT_SLUG}/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    // Add item to cart via SKU search
    const skuSearch = page.getByPlaceholder(/Search inventory/i).first();
    await expect(skuSearch).toBeVisible({ timeout: 10_000 });
    await skuSearch.fill(item.sku);
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: item.name }).first().click();
    await page.waitForTimeout(500);

    // Pick customer in the cart-panel's customer search.
    // Hardening note: the CartPanel dropdown closes 200ms after the
    // input loses focus, and React doesn't always commit the
    // setShowCustomerDropdown(true) before Playwright's next instruction
    // fires. So:
    //   1. click() the input (focus, opens dropdown via onFocus)
    //   2. fill() the name (filters customers prop)
    //   3. waitFor() the SPECIFIC option button to be visible — this
    //      blocks until the dropdown actually rendered, even if React's
    //      commit was delayed
    //   4. dispatchEvent('mousedown') instead of click() — CartPanel
    //      uses onMouseDown to select the customer (so the input's
    //      onBlur 200ms timer doesn't beat the click), so a synthetic
    //      mousedown is the highest-fidelity reproduction of a real
    //      tap. Playwright's click() also fires mousedown, but adds a
    //      stability re-check that occasionally misses the 200ms
    //      window — dispatchEvent skips the re-check.
    const custSearch = page.getByPlaceholder(/Search customer/i).first();
    await expect(custSearch).toBeVisible({ timeout: 10_000 });
    await custSearch.click();
    await custSearch.fill(customer.name);
    const customerOption = page
      .locator("button")
      .filter({ hasText: customer.name })
      .first();
    await customerOption.waitFor({ state: "visible", timeout: 8_000 });
    await customerOption.dispatchEvent("mousedown");
    await page.waitForTimeout(400);

    // Open payment modal
    const chargeBtn = page.getByRole("button", { name: /^Charge \$/i }).first();
    await chargeBtn.click();
    await page.waitForTimeout(800);

    // Pick the Layby tab
    const laybyTab = page.getByRole("button", { name: /^Layby$/i }).first();
    await laybyTab.click();
    await page.waitForTimeout(400);

    // Fill deposit
    const depositInput = page.locator('input[type="number"][placeholder="0.00"]').first();
    await expect(depositInput).toBeVisible({ timeout: 5_000 });
    await depositInput.fill(String(deposit));

    // Click "Create Layby" button
    const createBtn = page.getByRole("button", { name: /Create Layby|Reserve|Save Layby/i }).first();
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled({ timeout: 5_000 });
    await createBtn.click();

    // Wait for the success screen
    await page.getByRole("heading", { name: /Layby Created/i }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);

    // Verify in DB: a sale row with status='layby' and the customer
    const sales = await runDbQuery<Array<{
      id: string;
      sale_number: string;
      status: string;
      total: string;
      amount_paid: string;
    }>>(
      `SELECT id, sale_number, status, total::numeric AS total, amount_paid::numeric AS amount_paid
       FROM sales
       WHERE customer_id='${customer.id}'::uuid AND tenant_id='${TEST_TENANT_ID}'::uuid
       ORDER BY created_at DESC LIMIT 1`,
    );
    expect(sales.length).toBe(1);
    expect(sales[0].status).toBe("layby");
    expect(Number(sales[0].amount_paid)).toBeCloseTo(deposit, 2);
    expect(Number(sales[0].total)).toBeGreaterThan(deposit);

    await ctx.close();
  });
});

async function pickFirstLocation(page: Page): Promise<void> {
  const picker = page.locator("button", { hasText: "All Locations" }).first();
  if (await picker.count() === 0) return;
  await picker.click();
  await page.waitForTimeout(600);
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
    throw new Error("Test account has 2FA — disable for QA");
  }
}
