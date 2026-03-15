import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = "https://nexpura-oi49pm7ll-maisonjoves-projects.vercel.app";
const RT = 'nexpura-review-2026';
const OUT = '/tmp/cmd_vids';
mkdirSync(OUT, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT } });
  const page = await ctx.newPage();

  console.log("🎬 Recording Q-repair-command-center...");
  await page.goto(`${BASE}/repairs/09686ec7-0ec5-4950-ba7f-9982c9830d43?rt=${RT}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click Add Manual Item
  await page.getByRole('button', { name: /Add Manual Item/i }).click();
  await page.waitForTimeout(1000);
  await page.getByLabel(/Description/i).fill('Express Rush Fee');
  await page.getByLabel(/Unit Price/i).fill('50');
  await page.getByRole('button', { name: /^Add Item/i }).click();
  await page.waitForTimeout(2000);
  
  // Take Deposit
  await page.getByRole('button', { name: /Take Deposit/i }).click();
  await page.waitForTimeout(1000);
  await page.getByLabel(/Amount/i).fill('100');
  await page.getByRole('button', { name: /^Record Payment/i }).click();
  await page.waitForTimeout(2000);
  
  await page.close();
  const v1 = await page.video().path();
  require('fs').copyFileSync(v1, `/root/.openclaw/workspace/clients/joey/projects/nexpura/videos/Q-repair-command-center.webm`);
  
  
  console.log("🎬 Recording R-bespoke-command-center...");
  const page2 = await ctx.newPage();
  await page2.goto(`${BASE}/bespoke/ba62301b-0b26-423a-b02e-5a48bd7034b6?rt=${RT}`);
  await page2.waitForLoadState('networkidle');
  await page2.waitForTimeout(2000);
  
  // Advance stage
  await page2.getByRole('button', { name: /Mark Ready for Collection/i }).click();
  await page2.waitForTimeout(2000);
  
  // Record payment
  await page2.getByRole('button', { name: /Record Payment/i }).click();
  await page2.waitForTimeout(1000);
  await page2.getByLabel(/Amount/i).fill('5600');
  await page2.getByRole('button', { name: /^Record Payment/i }).click();
  await page2.waitForTimeout(2000);
  
  await page2.close();
  const v2 = await page2.video().path();
  require('fs').copyFileSync(v2, `/root/.openclaw/workspace/clients/joey/projects/nexpura/videos/R-bespoke-command-center.webm`);

  await browser.close();
  console.log("Done.");
}
run().catch(console.error);
