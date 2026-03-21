import puppeteer from "puppeteer-core";
import { mkdir } from "fs/promises";

const SCREENSHOTS_DIR = "./qa-screenshots";

async function takeScreenshots() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log("Taking screenshots using preview pages...\n");

  // Screenshot 1: QA Dashboard Main View
  console.log("1. QA Dashboard Main View...");
  try {
    await page.goto("http://localhost:3000/qa-preview", { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 1000)); // Wait for animations
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-qa-dashboard-main.png`, fullPage: false });
    console.log("   ✓ Saved: 01-qa-dashboard-main.png");
  } catch (e) {
    console.log("   ✗ Error:", e.message);
  }

  // Screenshot 2: Bug List Page
  console.log("2. Bug List Page...");
  try {
    await page.goto("http://localhost:3000/qa-preview/bugs", { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-qa-bug-list.png`, fullPage: false });
    console.log("   ✓ Saved: 02-qa-bug-list.png");
  } catch (e) {
    console.log("   ✗ Error:", e.message);
  }

  // Screenshot 3: Full page view with more detail
  console.log("3. QA Dashboard Full Page...");
  try {
    await page.goto("http://localhost:3000/qa-preview", { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-qa-full-page.png`, fullPage: true });
    console.log("   ✓ Saved: 03-qa-full-page.png");
  } catch (e) {
    console.log("   ✗ Error:", e.message);
  }

  await browser.close();
  console.log("\n✅ Screenshots saved to ./qa-screenshots/");
}

takeScreenshots().catch(console.error);
