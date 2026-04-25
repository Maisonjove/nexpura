import { test } from "@playwright/test";

test("debug location picker", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ baseURL: "https://nexpura-delta.vercel.app", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(process.env.NEXPURA_TEST_EMAIL!);
  await page.getByLabel(/password/i).first().fill(process.env.NEXPURA_TEST_PASSWORD!);
  await page.getByRole("button", { name: /^(sign in|log in)/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(2000);

  // Find the location picker — it has the "All Locations" label by default.
  const picker = page.getByRole("button", { name: /^All Locations$/i });
  console.log("picker count:", await picker.count());
  const pickerEl = picker.first();
  await pickerEl.click();
  await page.waitForTimeout(800);

  // After click, the dropdown should be in the DOM. Look for clickable
  // location items.
  console.log("--- after picker click, all visible buttons ---");
  const buttons = await page.locator("button:visible").all();
  for (const b of buttons.slice(0, 20)) {
    const txt = ((await b.textContent()) ?? "").trim().slice(0, 40);
    if (txt) console.log(` btn: "${txt}"`);
  }

  // Try clicking "test 4" specifically
  const target = page.locator("button", { hasText: /test 4/i }).first();
  console.log("test 4 count:", await target.count());
  if (await target.count() > 0) {
    await target.click();
    await page.waitForTimeout(1500);
    const newLabel = await page.getByRole("button", { name: /test 4/i }).first().textContent();
    console.log("after click, picker label:", (newLabel ?? "").slice(0, 40));
    console.log("cookies after click:");
    const cookies = await ctx.cookies();
    const loc = cookies.find((c) => c.name === "nx_location");
    console.log("  nx_location:", loc?.value, "domain:", loc?.domain, "path:", loc?.path);
  }

  await ctx.close();
});
