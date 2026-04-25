/**
 * Jeweller real-flow #4 — inventory item create.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   SUPABASE_PAT=... \
 *   pnpm exec playwright test e2e/jeweller-flow-inventory.spec.ts
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

test.describe("Inventory create flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.skip(!SUPABASE_PAT, "set SUPABASE_PAT");
  test.setTimeout(5 * 60 * 1000);

  test("create item → DB persistence + low-stock threshold", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);

    // Pick a specific location — inventory create rejects "All Locations".
    await page.goto(`/${TEST_TENANT_SLUG}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await pickFirstLocation(page);

    await page.goto(`/${TEST_TENANT_SLUG}/inventory/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const itemName = `QA Inventory Item ${stamp}`;
    const sku = `QA-INV-${stamp}`;
    const price = 199.95;
    const lowStock = 3;
    const initialQty = 12;

    // Required fields
    await page.locator('input[name="name"]').first().fill(itemName);
    await page.locator('input[name="sku"]').first().fill(sku);
    await page.locator('input[name="retail_price"]').first().fill(String(price));
    await page.locator('input[name="quantity"]').first().fill(String(initialQty));
    // Low-stock threshold (optional but useful for the alert flow)
    const lowStockInput = page.locator('input[name="low_stock_threshold"]').first();
    if (await lowStockInput.count() > 0) {
      await lowStockInput.fill(String(lowStock));
    }

    const submit = page.getByRole("button", { name: /^(Save|Create|Add Item|Submit)/i }).first();
    await expect(submit).toBeVisible();

    const responsePromise = page.waitForResponse(
      (r) => /\/inventory/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await submit.click();
    const response = await responsePromise;
    if (response) expect(response.status()).toBeLessThan(500);

    // After create the form action redirects either to /inventory or /inventory/[id]
    await page.waitForURL((url) => /\/inventory(\/[a-f0-9-]{36})?$/.test(url.pathname), {
      timeout: 30_000,
    });

    // Verify in DB
    const rows = await runDbQuery<Array<{ id: string; name: string; sku: string; quantity: number; retail_price: string; low_stock_threshold: number | null }>>(
      `SELECT id, name, sku, quantity, retail_price::numeric AS retail_price, low_stock_threshold
       FROM inventory WHERE sku = '${sku}' AND tenant_id = '${TEST_TENANT_ID}'::uuid`,
    );
    expect(rows.length, `inventory row with sku ${sku} should be present`).toBe(1);
    expect(rows[0].name).toBe(itemName);
    expect(rows[0].quantity).toBe(initialQty);
    expect(Number(rows[0].retail_price)).toBeCloseTo(price, 2);
    if (await lowStockInput.count() > 0) {
      expect(rows[0].low_stock_threshold).toBe(lowStock);
    }

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
