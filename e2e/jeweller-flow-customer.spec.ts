/**
 * Jeweller real-flow #1 — customer lifecycle.
 *
 * Acts as a real jeweller would: create a customer through the new-
 * customer form, search for them in the customer list, open their
 * detail page, edit a field, save, and verify the change persists. No
 * mocking — drives the production UI end-to-end.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   pnpm exec playwright test e2e/jeweller-flow-customer.spec.ts
 */

import { expect, test, type Page } from "@playwright/test";

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

    // Unique tag — avoids collisions if the test runs twice in the same minute.
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fullName = `QA Test Jeweller ${stamp}`;
    const phone = `04${Math.floor(10000000 + Math.random() * 89999999)}`;
    const email = `qa+${stamp}@example.test`;

    // ── Step 1: open new-customer form ─────────────────────────────────
    await page.goto(`/${slug}/customers/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Fill in the form. Selectors are best-effort — we try labels first,
    // then fall back to common name/placeholder patterns.
    await fillByLabelOrPlaceholder(page, /full.?name|name/i, fullName);
    await fillByLabelOrPlaceholder(page, /phone|mobile/i, phone);
    await fillByLabelOrPlaceholder(page, /email|e-?mail/i, email);

    // ── Step 2: submit ─────────────────────────────────────────────────
    const submit = page
      .getByRole("button", { name: /^(save|create|add customer|submit)/i })
      .first();
    await expect(submit).toBeVisible({ timeout: 10_000 });

    // Capture network response of the form-action POST so we can verify it
    // succeeded (not a 4xx/5xx).
    const responsePromise = page.waitForResponse(
      (r) => /\/customers/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await submit.click();
    const response = await responsePromise;
    if (response) {
      expect(response.status(), "POST /customers should not 5xx").toBeLessThan(500);
    }

    // Should redirect away from /customers/new — either to the customer
    // list or directly to the new customer's detail page.
    await page.waitForURL((url) => !url.pathname.endsWith("/customers/new"), {
      timeout: 30_000,
    });
    const afterCreateUrl = page.url();
    test.info().annotations.push({ type: "post-create-url", description: afterCreateUrl });

    // ── Step 3: search for the customer in the list ───────────────────
    await page.goto(`/${slug}/customers`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Look for a search/filter input
    const searchBox = page.getByPlaceholder(/search/i).or(page.getByLabel(/search/i)).first();
    if (await searchBox.count() > 0) {
      await searchBox.fill(fullName);
      await page.waitForTimeout(800);
    }

    // The customer's name should now be visible somewhere on the page.
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 10_000 });

    // ── Step 4: open the detail page by clicking the name ─────────────
    await page.getByText(fullName).first().click();
    await page.waitForURL(/\/customers\/[a-f0-9-]{36}/, { timeout: 30_000 });
    const customerId = page.url().match(/\/customers\/([a-f0-9-]{36})/)?.[1] ?? "";
    expect(customerId, "should land on a UUID detail page").toMatch(/^[a-f0-9-]{36}$/);

    // ── Step 5: edit a field ───────────────────────────────────────────
    // Open the edit page via /customers/[id]/edit (consistent across the codebase).
    await page.goto(`/${slug}/customers/${customerId}/edit`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const newPhone = `04${Math.floor(10000000 + Math.random() * 89999999)}`;
    await fillByLabelOrPlaceholder(page, /phone|mobile/i, newPhone);

    const saveBtn = page.getByRole("button", { name: /^(save|update|submit)/i }).first();
    const saveResponse = page.waitForResponse(
      (r) => /\/customers/.test(r.url()) && r.request().method() === "POST",
      { timeout: 30_000 },
    ).catch(() => null);
    await saveBtn.click();
    const saveR = await saveResponse;
    if (saveR) expect(saveR.status()).toBeLessThan(500);
    await page.waitForTimeout(2000);

    // ── Step 6: verify the new phone shows on the detail page ─────────
    await page.goto(`/${slug}/customers/${customerId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const html = await page.content();
    // Strip non-digits — some renderers space the phone (04 9916 2122)
    // or insert + prefixes (+61 491 6122). The persisted digits are what
    // we actually care about.
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

async function fillByLabelOrPlaceholder(page: Page, pattern: RegExp, value: string): Promise<void> {
  const byLabel = page.getByLabel(pattern).first();
  if (await byLabel.count() > 0 && await byLabel.isVisible().catch(() => false)) {
    await byLabel.fill(value);
    return;
  }
  const byPlaceholder = page.getByPlaceholder(pattern).first();
  if (await byPlaceholder.count() > 0 && await byPlaceholder.isVisible().catch(() => false)) {
    await byPlaceholder.fill(value);
    return;
  }
  // Fallback: input[name=...] matching the pattern's source words
  const tokens = pattern.source
    .toLowerCase()
    .replace(/[\\^$|?*+(){}[\].]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !["and","or","not"].includes(t));
  for (const t of tokens) {
    const byName = page.locator(`input[name*="${t}" i], textarea[name*="${t}" i]`).first();
    if (await byName.count() > 0 && await byName.isVisible().catch(() => false)) {
      await byName.fill(value);
      return;
    }
  }
  throw new Error(`Could not find an input matching ${pattern}`);
}
