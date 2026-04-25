/**
 * Jeweller real-flow #6 — bespoke job create.
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
  const name = `QA Bespoke Customer ${stamp}`;
  const sql = `
    INSERT INTO customers (tenant_id, full_name, first_name, last_name, email, phone)
    VALUES ('${TEST_TENANT_ID}'::uuid, '${name}', 'QA', 'Bespoke', 'qa+bespoke-${stamp}@example.test', '0400000000')
    RETURNING id, full_name AS name
  `;
  const rows = await runDbQuery<Array<{ id: string; name: string }>>(sql);
  return rows[0];
}

test.describe("Bespoke job create flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.skip(!SUPABASE_PAT, "set SUPABASE_PAT");
  test.setTimeout(5 * 60 * 1000);

  test("create bespoke job → DB persistence", async ({ browser }) => {
    const customer = await seedCustomer();

    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);

    await page.goto(`/${TEST_TENANT_SLUG}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await pickFirstLocation(page);

    await page.goto(`/${TEST_TENANT_SLUG}/bespoke/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Customer search → click matching result
    const customerSearch = page.getByPlaceholder(/Search customers/i).first();
    await expect(customerSearch).toBeVisible({ timeout: 10_000 });
    await customerSearch.fill(customer.name);
    await page.waitForTimeout(800);
    await page.getByText(customer.name).first().click();
    await page.waitForTimeout(500);

    const stamp = Date.now().toString(36);
    const title = `QA Bespoke Title ${stamp}`;
    await page.locator('input[name="title"]').first().fill(title);
    // jewellery_type is a select — pick the first non-empty option.
    await page.locator('select[name="jewellery_type"]').first().selectOption({ index: 1 });

    const submitBtn = page.getByRole("button", { name: /^(Save|Create|Submit)/i }).first();
    await expect(submitBtn).toBeVisible();
    const responsePromise = page.waitForResponse(
      (r) => /\/bespoke/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await submitBtn.click();
    const response = await responsePromise;
    if (response) expect(response.status()).toBeLessThan(500);

    // After save the action redirects to /bespoke/[id] or /bespoke
    await page.waitForURL((url) => /\/bespoke(\/[a-f0-9-]{36})?$/.test(url.pathname), { timeout: 30_000 });
    await page.waitForTimeout(1000);

    // Verify in DB
    const rows = await runDbQuery<Array<{ id: string; title: string; customer_id: string; stage: string }>>(
      `SELECT id, title, customer_id, stage FROM bespoke_jobs
       WHERE customer_id='${customer.id}'::uuid AND tenant_id='${TEST_TENANT_ID}'::uuid
       ORDER BY created_at DESC LIMIT 1`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe(title);
    expect(rows[0].stage).toBeTruthy();

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
