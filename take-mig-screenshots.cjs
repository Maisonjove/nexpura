// take-mig-screenshots.cjs
// CommonJS Playwright script - takes 20 screenshots and uploads to Supabase

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://nexpura-d23aumliv-maisonjoves-projects.vercel.app';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';

const SCREENSHOTS = [
  { file: 'MIG-01-hub-home.png',             path: '/migration?rt=nexpura-review-2026' },
  { file: 'MIG-02-source-selection.png',      path: '/migration/new?rt=nexpura-review-2026' },
  { file: 'MIG-03-files-classified.png',      path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/files?rt=nexpura-review-2026' },
  { file: 'MIG-04-mapping.png',               path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/mapping?rt=nexpura-review-2026' },
  { file: 'MIG-05-preview.png',               path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/preview?rt=nexpura-review-2026' },
  { file: 'MIG-06-results-main.png',          path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026' },
  { file: 'MIG-07-results-expansion.png',     path: '/migration/3fa58809-05a6-493b-8435-e99d92cc7aaf/results?rt=nexpura-review-2026' },
  { file: 'MIG-08-customers-list.png',        path: '/customers?rt=nexpura-review-2026' },
  { file: 'MIG-09-customer-detail.png',       path: '/customers/407dbb82-a57d-456e-a893-352171735a57?rt=nexpura-review-2026' },
  { file: 'MIG-10-inventory-list.png',        path: '/inventory?rt=nexpura-review-2026' },
  { file: 'MIG-11-inventory-detail.png',      path: '/inventory/af4eb6c4-22c1-4e0f-873d-a38bf9a26be4?rt=nexpura-review-2026' },
  { file: 'MIG-12-repairs-list.png',          path: '/repairs?rt=nexpura-review-2026' },
  { file: 'MIG-13-repair-detail.png',         path: '/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026' },
  { file: 'MIG-14-bespoke-list.png',          path: '/bespoke?rt=nexpura-review-2026' },
  { file: 'MIG-15-bespoke-detail.png',        path: '/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026' },
  { file: 'MIG-16-invoices-list.png',         path: '/invoices?rt=nexpura-review-2026' },
  { file: 'MIG-17-invoice-detail-paid.png',   path: '/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026' },
  { file: 'MIG-18-invoice-detail-partial.png',path: '/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026' },
  { file: 'MIG-19-suppliers-list.png',        path: '/suppliers?rt=nexpura-review-2026' },
  { file: 'MIG-20-supplier-detail.png',       path: '/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026' },
];

const OUTDIR = path.join(__dirname, 'mig-screenshots');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function uploadFile(filename, filepath) {
  const data = fs.readFileSync(filepath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}/${filename}`;
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Content-Length': data.length,
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verifyFile(filename) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/${filename}`;
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      headers: {}
    };
    
    const req = https.request(options, (res) => {
      // drain response
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
  
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Launching browser...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  const results = [];
  
  for (const shot of SCREENSHOTS) {
    const fullUrl = `${BASE_URL}${shot.path}`;
    const outPath = path.join(OUTDIR, shot.file);
    
    console.log(`\n[→] ${shot.file}`);
    console.log(`    URL: ${fullUrl}`);
    
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);
      await page.screenshot({ path: outPath, fullPage: false });
      
      const size = fs.statSync(outPath).size;
      console.log(`    Screenshot: ${size} bytes`);
      
      // Upload
      const uploadResult = await uploadFile(shot.file, outPath);
      console.log(`    Upload: ${uploadResult.status}`);
      
      // Verify
      const verifyStatus = await verifyFile(shot.file);
      console.log(`    Verify: ${verifyStatus}`);
      
      results.push({
        file: shot.file,
        size,
        uploadStatus: uploadResult.status,
        verifyStatus,
        uploadOk: uploadResult.status === 200 || uploadResult.status === 201,
        verifyOk: verifyStatus === 200,
      });
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      results.push({
        file: shot.file,
        size: 0,
        uploadStatus: 'ERROR',
        verifyStatus: 'ERROR',
        uploadOk: false,
        verifyOk: false,
        error: err.message,
      });
    }
  }
  
  await context.close();
  await browser.close();
  
  // Content checks using image text extraction via page text
  console.log('\n\n=== CONTENT CHECKS ===');
  
  // Re-launch for content checks
  const browser2 = await chromium.launch({ headless: true });
  const ctx2 = await browser2.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  
  const contentChecks = {};
  
  // MIG-15: must show "Abigail Young"
  await page2.goto(`${BASE_URL}/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const mig15text = await page2.content();
  contentChecks['MIG-15'] = mig15text.includes('Abigail Young') ? 'PASS - "Abigail Young" found' : 'FAIL - "Abigail Young" NOT found';
  console.log(`MIG-15: ${contentChecks['MIG-15']}`);
  
  // MIG-16: imported invoices NOT Draft
  await page2.goto(`${BASE_URL}/invoices?rt=nexpura-review-2026`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const mig16text = await page2.content();
  const hasDraft = mig16text.includes('Draft');
  const hasPaid = mig16text.includes('Paid');
  const hasSent = mig16text.includes('Sent');
  const hasPartial = mig16text.includes('Partial');
  contentChecks['MIG-16'] = `${!hasDraft ? 'PASS' : 'FAIL'} - Draft:${hasDraft} Paid:${hasPaid} Sent:${hasSent} Partial:${hasPartial}`;
  console.log(`MIG-16: ${contentChecks['MIG-16']}`);
  
  // MIG-17: INV-MIG-002, Paid, $4,200
  await page2.goto(`${BASE_URL}/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const mig17text = await page2.content();
  const mig17inv = mig17text.includes('INV-MIG-002');
  const mig17paid = mig17text.includes('Paid');
  const mig17amount = mig17text.includes('4,200') || mig17text.includes('4200');
  contentChecks['MIG-17'] = `${mig17inv && mig17paid && mig17amount ? 'PASS' : 'FAIL'} - INV-MIG-002:${mig17inv} Paid:${mig17paid} $4200:${mig17amount}`;
  console.log(`MIG-17: ${contentChecks['MIG-17']}`);
  
  // MIG-18: INV-MIG-004, Partially Paid, $200/$450
  await page2.goto(`${BASE_URL}/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const mig18text = await page2.content();
  const mig18inv = mig18text.includes('INV-MIG-004');
  const mig18partial = mig18text.includes('Partial');
  const mig18amount = (mig18text.includes('200') && mig18text.includes('450'));
  contentChecks['MIG-18'] = `${mig18inv && mig18partial && mig18amount ? 'PASS' : 'FAIL'} - INV-MIG-004:${mig18inv} Partial:${mig18partial} $200/$450:${mig18amount}`;
  console.log(`MIG-18: ${contentChecks['MIG-18']}`);
  
  await ctx2.close();
  await browser2.close();
  
  // Final report
  console.log('\n\n=== FINAL REPORT ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  
  let allOk = true;
  for (const r of results) {
    const status = r.uploadOk && r.verifyOk ? '✅' : '❌';
    if (!r.uploadOk || !r.verifyOk) allOk = false;
    console.log(`${status} ${r.file} | ${r.size} bytes | upload:${r.uploadStatus} | verify:${r.verifyStatus}${r.error ? ' | ERR:'+r.error : ''}`);
  }
  
  console.log('\nContent Checks:');
  for (const [k, v] of Object.entries(contentChecks)) {
    console.log(`  ${k}: ${v}`);
  }
  
  console.log(`\nOverall: ${allOk ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  
  // Save JSON report
  const report = { baseUrl: BASE_URL, results, contentChecks, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(OUTDIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${OUTDIR}/report.json`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
