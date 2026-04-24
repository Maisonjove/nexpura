import { test } from "@playwright/test";

test("POS diagnostic", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ baseURL: "https://nexpura-delta.vercel.app", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(process.env.NEXPURA_TEST_EMAIL!);
  await page.getByLabel(/password/i).first().fill(process.env.NEXPURA_TEST_PASSWORD!);
  await page.getByRole("button", { name: /^(sign in|log in)/i }).click();
  await page.waitForURL(/\/test-4-psd98\/dashboard/, { timeout: 30_000 });

  await page.goto("/test-4-psd98/pos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // What's on the page?
  console.log("URL:", page.url());
  console.log("Title:", await page.title());
  const inputs = await page.locator("input").all();
  console.log("input count:", inputs.length);
  for (const i of inputs.slice(0, 5)) {
    const ph = await i.getAttribute("placeholder");
    const type = await i.getAttribute("type");
    const visible = await i.isVisible();
    console.log(`  type=${type} placeholder="${ph}" visible=${visible}`);
  }
  const buttons = await page.locator("button").all();
  console.log("button count:", buttons.length);
  for (const b of buttons.slice(0, 8)) {
    const txt = (await b.textContent() ?? "").trim().slice(0, 60);
    const visible = await b.isVisible();
    if (txt) console.log(`  btn visible=${visible} text="${txt}"`);
  }
  // Find any "QA Test Ring" buttons
  const qaButtons = page.locator("button", { hasText: "QA Test Ring" });
  console.log("QA Test Ring button count:", await qaButtons.count());

  await page.screenshot({ path: "test-results/pos-diag.png", fullPage: true });
  await ctx.close();
});
