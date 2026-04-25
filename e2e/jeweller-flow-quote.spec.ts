/**
 * Jeweller real-flow #5 — quote create.
 *
 * Drives /quotes/new: pre-seeded customer is picked from the dropdown,
 * one line item is filled (description + qty + unit price), submitted,
 * persistence + line-item totals verified in DB.
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
  const name = `QA Quote Customer ${stamp}`;
  const sql = `
    INSERT INTO customers (tenant_id, full_name, first_name, last_name, email, phone)
    VALUES ('${TEST_TENANT_ID}'::uuid, '${name}', 'QA', 'Quote', 'qa+quote-${stamp}@example.test', '0400000000')
    RETURNING id, full_name AS name
  `;
  const rows = await runDbQuery<Array<{ id: string; name: string }>>(sql);
  return rows[0];
}

test.describe("Quote create flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.skip(!SUPABASE_PAT, "set SUPABASE_PAT");
  test.setTimeout(5 * 60 * 1000);

  test("create quote with line item → verify persisted", async ({ browser }) => {
    const customer = await seedCustomer();

    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);

    // Quote create needs a specific location selected.
    await page.goto(`/${TEST_TENANT_SLUG}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await pickFirstLocation(page);

    await page.goto(`/${TEST_TENANT_SLUG}/quotes/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Customer select — driven by React state. Pick by visible option label.
    const customerSelect = page.locator("select").first();
    await expect(customerSelect).toBeVisible({ timeout: 10_000 });
    await customerSelect.selectOption({ label: customer.name });
    await page.waitForTimeout(300);

    // First item row: description / qty / price.
    const itemDesc = `QA quote line item ${Date.now().toString(36)}`;
    const qty = 2;
    const unitPrice = 125;
    await page.getByPlaceholder(/Item description/i).first().fill(itemDesc);
    // Qty + Price are number inputs in narrow columns — locate the
    // sibling numeric inputs after the description input.
    await page.getByPlaceholder(/^Qty$/i).first().fill(String(qty));
    await page.getByPlaceholder(/^Price$/i).first().fill(String(unitPrice));
    await page.waitForTimeout(300);

    // Submit
    const submitBtn = page.getByRole("button", { name: /^(Save|Create|Send|Generate)/i }).first();
    await expect(submitBtn).toBeVisible();
    const responsePromise = page.waitForResponse(
      (r) => /\/quotes/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await submitBtn.click();
    const response = await responsePromise;
    if (response) expect(response.status()).toBeLessThan(500);

    // Quote create redirects back to /quotes (the list) on success.
    await page.waitForURL((url) => url.pathname.endsWith("/quotes"), { timeout: 30_000 });
    await page.waitForTimeout(1000);

    // Verify in DB by customer_id. The quotes table stores the line-item
    // list as a jsonb `items` column (not a separate quote_items table).
    const quoteRows = await runDbQuery<Array<{
      id: string;
      customer_id: string;
      total_amount: string;
      items: Array<{ description: string; quantity: number; unit_price: number }>;
    }>>(
      `SELECT id, customer_id, total_amount::numeric AS total_amount, items
       FROM quotes WHERE customer_id='${customer.id}'::uuid AND tenant_id='${TEST_TENANT_ID}'::uuid
       ORDER BY created_at DESC LIMIT 1`,
    );
    expect(quoteRows.length, `quote should exist for customer ${customer.id}`).toBe(1);

    const items = quoteRows[0].items ?? [];
    expect(items.length, "quote should have one line item").toBe(1);
    expect(items[0].description).toBe(itemDesc);
    expect(items[0].quantity).toBe(qty);
    expect(Number(items[0].unit_price)).toBeCloseTo(unitPrice, 2);
    // total_amount = qty * unit_price (no tax/discount in this scenario)
    expect(Number(quoteRows[0].total_amount)).toBeCloseTo(qty * unitPrice, 2);

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
