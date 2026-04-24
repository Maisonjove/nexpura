/**
 * Jeweller real-flow #2 — POS sale (single item + multi-item).
 *
 * Pre-seeds inventory rows directly via the Supabase Management API so
 * the test isn't coupled to the inventory-create UI. Drives the POS UI
 * end-to-end: open /pos, click product cards to add to cart, charge,
 * pay cash, verify the sale lands in the sales table.
 *
 * Two scenarios:
 *   1. Single item — verifies happy path of the new pos_deduct_stock RPC.
 *   2. 8-item cart — exercises the N→1 RPC win on a realistic cart.
 *
 * Run:
 *   BASE_URL=https://nexpura-delta.vercel.app \
 *   NEXPURA_TEST_EMAIL=... NEXPURA_TEST_PASSWORD=... \
 *   pnpm exec playwright test e2e/jeweller-flow-pos.spec.ts
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://nexpura-delta.vercel.app";
const EMAIL = process.env.NEXPURA_TEST_EMAIL;
const PASSWORD = process.env.NEXPURA_TEST_PASSWORD;
const SUPABASE_PROJECT_REF = "vkpjocnrefjfpuovzinn";
const SUPABASE_PAT = process.env.SUPABASE_PAT;

const TEST_TENANT_SLUG = "test-4-psd98";
const TEST_TENANT_ID = "25841dae-5124-4206-8c55-d05fd4e28d3c";

interface SeededItem {
  id: string;
  name: string;
  sku: string;
  price: number;
}

// Seed N inventory items. Each SKU is globally unique so concurrent
// test workers + retries never collide.
async function seedInventory(n: number): Promise<SeededItem[]> {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const items: SeededItem[] = [];
  for (let i = 0; i < n; i++) {
    items.push({
      id: "",
      name: `QA Test Ring ${stamp}-${i + 1}`,
      sku: `QA-${stamp}-${i + 1}`,
      price: 50 + i * 10,
    });
  }
  const valuesSql = items.map(
    (it) =>
      `('${TEST_TENANT_ID}'::uuid, '${it.name.replace(/'/g, "''")}', '${it.sku}', ${it.price}, 50, 5, 'active', true)`,
  );
  const sql = `
    INSERT INTO inventory (tenant_id, name, sku, retail_price, quantity, low_stock_threshold, status, track_quantity)
    VALUES ${valuesSql.join(",\n")}
    RETURNING id, name, sku, retail_price::numeric AS price
  `;
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
  if (!r.ok) throw new Error(`Failed to seed inventory: ${r.status} ${await r.text()}`);
  const rows = (await r.json()) as Array<{ id: string; name: string; sku: string; price: string }>;
  return rows.map((row) => {
    const seeded = items.find((it) => it.sku === row.sku)!;
    seeded.id = row.id;
    return seeded;
  });
}

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

test.describe("POS sale flow", () => {
  test.skip(!EMAIL || !PASSWORD, "set NEXPURA_TEST_EMAIL + NEXPURA_TEST_PASSWORD");
  test.skip(!SUPABASE_PAT, "set SUPABASE_PAT for inventory seeding");
  test.setTimeout(5 * 60 * 1000);

  test("single-item sale → cash payment → sale persisted", async ({ browser }) => {
    const items = await seedInventory(1);
    const item = items[0];
    test.info().annotations.push({ type: "seeded-item", description: `${item.name} ($${item.price})` });

    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Capture every console error + page exception + 5xx network response
    // for the full duration of this test — printed at the end so we know
    // exactly where things fell over.
    const captured: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") captured.push(`[console] ${m.text().slice(0, 300)}`);
    });
    page.on("pageerror", (err) => {
      captured.push(`[pageerror] ${err.message.slice(0, 300)}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 500) captured.push(`[5xx] ${r.request().method()} ${r.url()} -> ${r.status()}`);
    });

    await login(page, TEST_TENANT_SLUG);

    // ── 1. Open POS ───────────────────────────────────────────────────
    await page.goto(`/${TEST_TENANT_SLUG}/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const locationGate = page.getByText(/Select a Location/i).first();
    if (await locationGate.count() > 0 && await locationGate.isVisible().catch(() => false)) {
      await page.getByText(/Main Store|test 4|test 5/i).first().click();
      await page.waitForTimeout(1500);
    }
    test.info().annotations.push({ type: "captured-pre-charge", description: captured.join(" | ") || "(none)" });

    // The grid renders ALL items; ours might be below the fold among
    // many other test fixtures. Use the inventory search box to filter
    // down to just this item before clicking — that mimics how a real
    // jeweller scans / types the SKU at checkout anyway.
    const searchInput = page.getByPlaceholder(/Search inventory/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(item.sku);
    await page.waitForTimeout(500);

    const productBtn = page.locator("button", { hasText: item.name }).first();
    await expect(productBtn, "seeded product should appear in POS grid after SKU search").toBeVisible({ timeout: 10_000 });
    await productBtn.click();
    await page.waitForTimeout(500);

    // ── 2. Charge ─────────────────────────────────────────────────────
    const chargeBtn = page.getByRole("button", { name: /^Charge \$/i }).first();
    await expect(chargeBtn).toBeVisible({ timeout: 5_000 });
    // Snapshot the actual displayed total (price + tax) so we tender the
    // exact amount — POS adds tax on top of retail_price for sales tax,
    // so the on-button total != raw retail.
    const chargeText = (await chargeBtn.textContent()) ?? "";
    const displayedTotal = Number(chargeText.replace(/[^0-9.]/g, "")) || item.price * 1.5;
    await chargeBtn.click();
    await page.waitForTimeout(800);

    // ── 3. Cash tab ───────────────────────────────────────────────────
    const cashTab = page.getByRole("button", { name: /^Cash$/i }).first();
    await expect(cashTab).toBeVisible({ timeout: 5_000 });
    await cashTab.click();
    await page.waitForTimeout(300);

    // Tender exact amount (covers tax, button enables when tendered >= total)
    const cashInput = page.locator('input[type="number"][placeholder="0.00"]').first();
    await expect(cashInput).toBeVisible({ timeout: 5_000 });
    await cashInput.fill(displayedTotal.toFixed(2));

    // Complete sale
    const completeBtn = page.getByRole("button", { name: /Complete Cash Sale/i }).first();
    await expect(completeBtn).toBeVisible();
    await expect(completeBtn).toBeEnabled({ timeout: 5_000 });
    await completeBtn.click();

    // ── 4. Wait for completion (success modal or screen) ──────────────
    // Capture the createPOSSale action's response — it's a server-action POST to /pos.
    // We just wait for some signal that it landed: either a "Sale complete" UI
    // or the cart cleared (Charge button text resets).
    // SaleSuccessScreen is the "Sale Complete ✅" view — wait for it.
    await page.getByRole("heading", { name: /Sale Complete/i }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);

    // ── 5. Verify in DB ───────────────────────────────────────────────
    const sales = await runDbQuery<Array<{ id: string; sale_number: string; total: string; status: string }>>(
      `SELECT s.id, s.sale_number, s.total::numeric AS total, s.status FROM sales s
       WHERE s.tenant_id = '${TEST_TENANT_ID}'::uuid
         AND EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.inventory_id = '${item.id}'::uuid)
       ORDER BY s.created_at DESC LIMIT 1`,
    );
    expect(sales.length, "sale should be recorded for the seeded inventory").toBeGreaterThan(0);
    // Sale total includes server-recomputed tax — should match the
    // displayed total within a cent.
    expect(Number(sales[0].total)).toBeCloseTo(displayedTotal, 2);
    expect(sales[0].status).toBe("paid");

    // Verify stock was deducted
    const inv = await runDbQuery<Array<{ quantity: number }>>(
      `SELECT quantity FROM inventory WHERE id = '${item.id}'::uuid`,
    );
    expect(inv[0].quantity).toBe(49); // 50 - 1

    // Verify stock_movements row was inserted by the new pos_deduct_stock RPC
    const movements = await runDbQuery<Array<{ quantity_change: number; movement_type: string }>>(
      `SELECT quantity_change, movement_type FROM stock_movements
       WHERE tenant_id = '${TEST_TENANT_ID}'::uuid AND inventory_id = '${item.id}'::uuid
       ORDER BY created_at DESC LIMIT 1`,
    );
    expect(movements.length).toBe(1);
    expect(movements[0].quantity_change).toBe(-1);
    expect(movements[0].movement_type).toBe("sale");

    await ctx.close();
  });

  test("8-item multi-cart sale → exercises pos_deduct_stock RPC", async ({ browser }) => {
    const items = await seedInventory(8);
    const expectedTotal = items.reduce((s, i) => s + i.price, 0);
    test.info().annotations.push({
      type: "seeded-items",
      description: `${items.length} items totaling $${expectedTotal}`,
    });

    const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, TEST_TENANT_SLUG);

    await page.goto(`/${TEST_TENANT_SLUG}/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // POS gates on a specific location selection — when "All Locations"
    // is active in the picker, the page renders only the "Select a
    // Location" prompt. Click the first location card to enter POS.
    const locationGate = page.getByText(/Select a Location/i).first();
    if (await locationGate.count() > 0 && await locationGate.isVisible().catch(() => false)) {
      // Click any location card
      await page.getByText(/Main Store|test 4|test 5/i).first().click();
      await page.waitForTimeout(1500);
    }

    // Click each seeded item once — search by SKU per-item to avoid the
    // "below the fold" problem when prior runs leave many fixtures.
    const searchInput = page.getByPlaceholder(/Search inventory/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    for (const item of items) {
      await searchInput.fill(item.sku);
      await page.waitForTimeout(300);
      const btn = page.locator("button", { hasText: item.name }).first();
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await btn.click();
      await page.waitForTimeout(150);
    }
    // Clear the search so the cart panel is fully visible
    await searchInput.fill("");
    await page.waitForTimeout(300);

    const chargeBtn = page.getByRole("button", { name: /^Charge \$/i }).first();
    await expect(chargeBtn).toBeVisible();
    const chargeText = (await chargeBtn.textContent()) ?? "";
    const displayedTotal = Number(chargeText.replace(/[^0-9.]/g, "")) || expectedTotal * 1.5;
    // POS adds tax on top, so displayed total >= pre-tax sum.
    expect(displayedTotal).toBeGreaterThanOrEqual(expectedTotal);

    await chargeBtn.click();
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /^Cash$/i }).first().click();
    await page.waitForTimeout(300);
    await page.locator('input[type="number"][placeholder="0.00"]').first().fill(displayedTotal.toFixed(2));
    await page.getByRole("button", { name: /Complete Cash Sale/i }).first().click();

    // SaleSuccessScreen is the "Sale Complete ✅" view — wait for it.
    await page.getByRole("heading", { name: /Sale Complete/i }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);

    // ── Verify all 8 items deducted + sale_items + sale recorded ──────
    const itemIdList = items.map((i) => `'${i.id}'::uuid`).join(",");
    const sales = await runDbQuery<Array<{ id: string; total: string; sku_count: number }>>(
      `SELECT s.id, s.total::numeric AS total,
              (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS sku_count
       FROM sales s
       WHERE s.tenant_id = '${TEST_TENANT_ID}'::uuid
         AND s.id IN (
           SELECT DISTINCT sale_id FROM sale_items
           WHERE tenant_id = '${TEST_TENANT_ID}'::uuid
             AND inventory_id IN (${itemIdList})
         )
       ORDER BY s.created_at DESC LIMIT 1`,
    );
    expect(sales.length, "multi-item sale should land in DB").toBeGreaterThan(0);
    expect(Number(sales[0].total)).toBeCloseTo(displayedTotal, 2);
    expect(Number(sales[0].sku_count)).toBe(8);

    // Each inventory row should show quantity 49 (50 - 1)
    const inv = await runDbQuery<Array<{ id: string; quantity: number }>>(
      `SELECT id, quantity FROM inventory WHERE id IN (${itemIdList})`,
    );
    expect(inv.length).toBe(8);
    for (const row of inv) {
      expect(row.quantity, `${row.id} should have qty 49 after sale of 1`).toBe(49);
    }

    // 8 stock_movements rows should have been inserted by pos_deduct_stock
    const moves = await runDbQuery<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count FROM stock_movements
       WHERE tenant_id = '${TEST_TENANT_ID}'::uuid
         AND inventory_id IN (${itemIdList})
         AND movement_type = 'sale'`,
    );
    expect(Number(moves[0].count)).toBe(8);

    await ctx.close();
  });
});

async function login(page: Page, expectedSlug?: string): Promise<string> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(EMAIL!);
  await page.getByLabel(/password/i).first().fill(PASSWORD!);
  await page.getByRole("button", { name: /^(sign in|log in|continue)/i }).click();
  await page.waitForURL(/\/[a-z0-9-]+\/(dashboard|verify-2fa|onboarding)/, { timeout: 30_000 });
  if (page.url().includes("/verify-2fa")) {
    throw new Error("Test account has 2FA — disable for QA or use a non-2FA account");
  }
  const slug = page.url().match(/\/([a-z0-9-]+)\//)?.[1] ?? "";
  if (expectedSlug && slug !== expectedSlug) {
    throw new Error(`expected slug ${expectedSlug}, got ${slug}`);
  }
  return slug;
}
