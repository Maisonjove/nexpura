const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://nexpura-jirpliwze-maisonjoves-projects.vercel.app';
const OUT_DIR = '/tmp/nexpura-design-screenshots';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ROUTES = [
  { file: 'DESIGN-01-home-hero.png', url: '/?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-02-home-modules.png', url: '/?rt=nexpura-review-2026', scroll: 1800 },
  { file: 'DESIGN-03-pricing.png', url: '/pricing?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-04-switching.png', url: '/switching?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-05-contact.png', url: '/contact?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-06-features.png', url: '/features?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-07-dashboard.png', url: '/dashboard?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-08-repair-cc.png', url: '/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-09-bespoke-cc.png', url: '/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-10-pos.png', url: '/pos?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-11-invoices.png', url: '/invoices?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-12-inventory.png', url: '/inventory?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-13-customers.png', url: '/customers?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-14-migration-hub.png', url: '/migration?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-15-migration-results.png', url: '/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-16-suppliers.png', url: '/suppliers?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-17-tasks.png', url: '/tasks?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-18-billing.png', url: '/billing?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-19-settings.png', url: '/settings?rt=nexpura-review-2026', scroll: 0 },
  { file: 'DESIGN-20-review-repair.png', url: '/review/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75', scroll: 0 },
  { file: 'DESIGN-21-proof-gallery.png', url: '/verification/migration?rt=nexpura-review-2026', scroll: 0 },
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const route of ROUTES) {
    const fullUrl = BASE_URL + route.url;
    console.log(`Capturing: ${route.file} → ${route.url}`);
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      if (route.scroll > 0) {
        await page.evaluate((y) => window.scrollTo(0, y), route.scroll);
        await page.waitForTimeout(500);
      }
      const outPath = path.join(OUT_DIR, route.file);
      await page.screenshot({ path: outPath });
      console.log(`  ✓ Saved: ${outPath}`);
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      // Take screenshot anyway showing error state
      try {
        const outPath = path.join(OUT_DIR, route.file);
        await page.screenshot({ path: outPath });
        console.log(`  ~ Saved error state: ${outPath}`);
      } catch (e2) {
        console.log(`  ✗ Could not save error state: ${e2.message}`);
      }
    }
  }

  await browser.close();
  console.log('\nAll screenshots done. Output dir:', OUT_DIR);
  console.log('Files:', fs.readdirSync(OUT_DIR).sort().join('\n'));
})();
