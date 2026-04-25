/**
 * Jeweller real-flow #1 — customer lifecycle.
 *
 * Acts as a real jeweller: opens /customers/new, fills the form with
 * unique-per-run data, submits, then re-opens the customer's edit page,
 * changes the phone number, saves, and verifies the change persists in
 * the DB. Selectors target `name="..."` directly because the form's
 * <Label> component is a styled wrapper that doesn't use `htmlFor`, so
 * Playwright's getByLabel() returns nothing.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   pnpm exec playwright test e2e/jeweller-flow-customer.spec.ts
 */

import { expect, test, type Page, type Response } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://nexpura-delta.vercel.app";
const EMAIL = process.env.NEXPURA_TEST_EMAIL;
const PASSWORD = process.env.NEXPURA_TEST_PASSWORD;

test.describe("Customer flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.setTimeout(5 * 60 * 1000);

  test("create → search → edit → verify persistence", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const slug = await login(page);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const firstName = `QATest${stamp.slice(-6)}`;
    const lastName = `Jeweller`;
    const phone = `04${Math.floor(10000000 + Math.random() * 89999999)}`;
    const email = `qa+${stamp}@example.test`;

    // ── Step 1: open new-customer form ─────────────────────────────────
    await page.goto(`/${slug}/customers/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await fillByName(page, "first_name", firstName);
    await fillByName(page, "last_name", lastName);
    await fillByName(page, "email", email);
    await fillByName(page, "mobile", phone);

    // ── Step 2: submit ─────────────────────────────────────────────────
    const submit = page.getByRole("button", { name: /^(save|create|add customer|submit)/i }).first();
    await expect(submit).toBeVisible({ timeout: 10_000 });

    const responsePromise = page.waitForResponse(
      (r) => /\/customers/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await submit.click();
    const response = await responsePromise;
    if (response) {
      expect(response.status(), "POST /customers (create) should not 5xx").toBeLessThan(500);
    }

    await page.waitForURL((url) => !url.pathname.endsWith("/customers/new"), { timeout: 30_000 });

    // After create the action redirects to /customers/[id]
    const customerId = page.url().match(/\/customers\/([a-f0-9-]{36})/)?.[1] ?? "";
    expect(customerId, "should redirect to /customers/[id] after create").toMatch(/^[a-f0-9-]{36}$/);

    // ── Step 3: search for the customer in the list ───────────────────
    await page.goto(`/${slug}/customers`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const searchBox = page.getByPlaceholder(/search/i).or(page.getByLabel(/search/i)).first();
    if (await searchBox.count() > 0) {
      await searchBox.fill(firstName);
      await page.waitForTimeout(800);
    }

    await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 10_000 });

    // ── Step 4: edit the mobile field ─────────────────────────────────
    await page.goto(`/${slug}/customers/${customerId}/edit`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const newPhone = `04${Math.floor(10000000 + Math.random() * 89999999)}`;
    // Verify the form pre-populated with the original phone before edit.
    const mobileInput = page.locator('input[name="mobile"]').first();
    await expect(mobileInput).toBeVisible({ timeout: 10_000 });
    const before = await mobileInput.inputValue();
    expect(before, "edit form should preload current mobile").toBe(phone);

    await mobileInput.fill(newPhone);
    expect(await mobileInput.inputValue()).toBe(newPhone);

    const saveBtn = page.getByRole("button", { name: /^(save|update|submit)/i }).first();
    const saveResponsePromise = page.waitForResponse(
      (r) => /\/customers/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await saveBtn.click();
    const saveR: Response | null = await saveResponsePromise;
    if (saveR) {
      const status = saveR.status();
      // RSC server-action POST returns 200 on success. 4xx/5xx == fail.
      const body = await saveR.text().catch(() => "");
      expect(status, `save POST should 200 (got ${status}); body: ${body.slice(0, 300)}`).toBe(200);
      // Body should NOT contain a structured error digest — that signals
      // a thrown error inside the action.
      expect(body, `save response should not carry an error digest; body: ${body.slice(0, 300)}`).not.toMatch(/E\{"digest"/);
    }

    // Wait for the post-save redirect
    await page.waitForURL((url) => !url.pathname.endsWith("/edit"), { timeout: 30_000 });
    await page.waitForTimeout(1500);

    // ── Step 5: verify on the detail page ────────────────────────────
    await page.goto(`/${slug}/customers/${customerId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const html = await page.content();
    const digits = html.replace(/\D/g, "");
    expect(digits, `phone digits ${newPhone} should appear on detail page after edit`).toContain(newPhone);

    await ctx.close();
  });
});

async function login(page: Page): Promise<string> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(EMAIL!);
  await page.getByLabel(/password/i).first().fill(PASSWORD!);
  await page.getByRole("button", { name: /^(sign in|log in|continue)/i }).click();
  await page.waitForURL(/\/[a-z0-9-]+\/(dashboard|verify-2fa|onboarding)/, { timeout: 30_000 });
  if (page.url().includes("/verify-2fa")) {
    throw new Error("Test account has 2FA — disable for QA or use a non-2FA account");
  }
  const slug = page.url().match(/\/([a-z0-9-]+)\//)?.[1] ?? "";
  if (!slug) throw new Error(`couldn't derive slug from ${page.url()}`);
  return slug;
}

async function fillByName(page: Page, name: string, value: string): Promise<void> {
  const input = page.locator(`input[name="${name}"], textarea[name="${name}"]`).first();
  await expect(input, `input[name="${name}"] should be visible`).toBeVisible({ timeout: 10_000 });
  await input.fill(value);
}
