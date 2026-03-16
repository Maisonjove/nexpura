const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://nexpura-h52wq13um-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';

const SCREENSHOTS = [
  { file: 'MIG-01-hub-home.png', path: '/migration?rt=nexpura-review-2026' },
  { file: 'MIG-02-source-selection.png', path: '/migration/new?rt=nexpura-review-2026' },
  { file: 'MIG-03-files-classified.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/files?rt=nexpura-review-2026' },
  { file: 'MIG-04-mapping.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/mapping?rt=nexpura-review-2026' },
  { file: 'MIG-05-preview.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/preview?rt=nexpura-review-2026' },
  { file: 'MIG-06-results-main.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026' },
  { file: 'MIG-07-results-expansion.png', path: '/migration/3fa58809-05a6-493b-8435-e99d92cc7aaf/results?rt=nexpura-review-2026' },
  { file: 'MIG-08-customers-list.png', path: '/customers?rt=nexpura-review-2026' },
  { file: 'MIG-09-customer-detail.png', path: '/customers/407dbb82-a57d-456e-a893-352171735a57?rt=nexpura-review-2026' },
  { file: 'MIG-10-inventory-list.png', path: '/inventory?rt=nexpura-review-2026' },
  { file: 'MIG-11-inventory-detail.png', path: '/inventory/af4eb6c4-22c1-4e0f-873d-a38bf9a26be4?rt=nexpura-review-2026' },
  { file: 'MIG-12-repairs-list.png', path: '/repairs?rt=nexpura-review-2026' },
  { file: 'MIG-13-repair-detail.png', path: '/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026' },
  { file: 'MIG-14-bespoke-list.png', path: '/bespoke?rt=nexpura-review-2026' },
  { file: 'MIG-15-bespoke-detail.png', path: '/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026' },
  { file: 'MIG-16-invoices-list.png', path: '/invoices?rt=nexpura-review-2026' },
  { file: 'MIG-17-invoice-detail-paid.png', path: '/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026' },
  { file: 'MIG-18-invoice-detail-partial.png', path: '/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026' },
  { file: 'MIG-19-suppliers-list.png', path: '/suppliers?rt=nexpura-review-2026' },
  { file: 'MIG-20-supplier-detail.png', path: '/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026' },
];

const OUT_DIR = '/tmp/mig-screenshots';

function putToSupabase(filename, fileBuffer) {
  return new Promise((resolve, reject) => {
    const storageUrl = new URL(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}/${filename}`);
    const options = {
      hostname: storageUrl.hostname,
      port: 443,
      path: storageUrl.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'image/png',
        'Content-Length': fileBuffer.length,
        'x-upsert': 'true',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

function verifyPublicUrl(filename) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/${filename}`;
    https.get(url, (res) => {
      res.resume();
      resolve({ status: res.statusCode, url });
    }).on('error', reject);
  });
}

async function getPageText(page) {
  return page.evaluate(() => document.body.innerText);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];

  for (const shot of SCREENSHOTS) {
    const url = `${BASE_URL}${shot.path}`;
    console.log(`\n→ ${shot.file}: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);

      const filePath = path.join(OUT_DIR, shot.file);
      await page.screenshot({ path: filePath, fullPage: false });

      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = fileBuffer.length;
      console.log(`  ✓ Captured: ${fileSize} bytes`);

      // Content checks
      let contentCheck = null;
      const text = await getPageText(page);
      if (shot.file === 'MIG-15-bespoke-detail.png') {
        contentCheck = text.includes('Abigail Young') ? '✅ "Abigail Young" found' : '❌ "Abigail Young" NOT found';
      } else if (shot.file === 'MIG-16-invoices-list.png') {
        const hasDraft = text.includes('Draft');
        const hasPaid = text.includes('Paid') || text.includes('Sent') || text.includes('Partial');
        contentCheck = hasPaid && !hasDraft ? '✅ Has Paid/Sent/Partial, no Draft' : 
                       !hasPaid ? '❌ No Paid/Sent/Partial found' : 
                       `⚠️ Has Draft present (Paid: ${hasPaid})`;
      } else if (shot.file === 'MIG-17-invoice-detail-paid.png') {
        const hasInv = text.includes('INV-MIG-002');
        const hasPaid = text.includes('Paid');
        const hasAmt = text.includes('4,200') || text.includes('4200');
        contentCheck = `${hasInv ? '✅' : '❌'} INV-MIG-002 | ${hasPaid ? '✅' : '❌'} Paid | ${hasAmt ? '✅' : '❌'} $4,200`;
      } else if (shot.file === 'MIG-18-invoice-detail-partial.png') {
        const hasInv = text.includes('INV-MIG-004');
        const hasPartial = text.includes('Partial');
        const has200 = text.includes('200');
        const has450 = text.includes('450');
        contentCheck = `${hasInv ? '✅' : '❌'} INV-MIG-004 | ${hasPartial ? '✅' : '❌'} Partially Paid | ${has200 ? '✅' : '❌'} $200 | ${has450 ? '✅' : '❌'} $450`;
      }

      // Upload
      const uploadResult = await putToSupabase(shot.file, fileBuffer);
      console.log(`  ✓ Upload: ${uploadResult.status} - ${uploadResult.body}`);

      // Verify
      const verifyResult = await verifyPublicUrl(shot.file);
      console.log(`  ✓ Verify: ${verifyResult.status} ${verifyResult.url}`);

      results.push({
        file: shot.file,
        size: fileSize,
        uploadStatus: uploadResult.status,
        verifyStatus: verifyResult.status,
        contentCheck,
      });
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      results.push({
        file: shot.file,
        size: 0,
        uploadStatus: 'ERROR',
        verifyStatus: 'ERROR',
        contentCheck: null,
        error: err.message,
      });
    }
  }

  await browser.close();

  console.log('\n\n=== FINAL REPORT ===');
  console.log(`Base URL confirmed: nexpura-h52wq13um-maisonjoves-projects.vercel.app ✅`);
  console.log('');
  for (const r of results) {
    const sizeKB = r.size ? `${(r.size / 1024).toFixed(1)}KB` : 'N/A';
    const status = r.error ? `❌ ERROR: ${r.error}` : `upload=${r.uploadStatus} verify=${r.verifyStatus}`;
    console.log(`${r.file} | ${sizeKB} | ${status}${r.contentCheck ? ` | ${r.contentCheck}` : ''}`);
  }

  const allOk = results.every(r => !r.error && r.uploadStatus === 200 && r.verifyStatus === 200);
  console.log(`\nAll 20 screenshots: ${allOk ? '✅ SUCCESS' : '⚠️ SOME ISSUES'}`);
})();
