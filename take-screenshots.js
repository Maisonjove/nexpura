const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://nexpura-k4kdoswti-maisonjoves-projects.vercel.app';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration/';

const SCREENSHOTS = [
  { filename: 'MIG-01-hub-home.png', path: '/migration?rt=nexpura-review-2026' },
  { filename: 'MIG-02-source-selection.png', path: '/migration/new?rt=nexpura-review-2026' },
  { filename: 'MIG-03-files-classified.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/files?rt=nexpura-review-2026' },
  { filename: 'MIG-04-mapping.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/mapping?rt=nexpura-review-2026' },
  { filename: 'MIG-05-preview.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/preview?rt=nexpura-review-2026' },
  { filename: 'MIG-06-results-main.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026' },
  { filename: 'MIG-07-results-expansion.png', path: '/migration/3fa58809-05a6-493b-8435-e99d92cc7aaf/results?rt=nexpura-review-2026' },
  { filename: 'MIG-08-customers-list.png', path: '/customers?rt=nexpura-review-2026' },
  { filename: 'MIG-09-customer-detail.png', path: '/customers/407dbb82-a57d-456e-a893-352171735a57?rt=nexpura-review-2026' },
  { filename: 'MIG-10-inventory-list.png', path: '/inventory?rt=nexpura-review-2026' },
  { filename: 'MIG-11-inventory-detail.png', path: '/inventory/af4eb6c4-22c1-4e0f-873d-a38bf9a26be4?rt=nexpura-review-2026' },
  { filename: 'MIG-12-repairs-list.png', path: '/repairs?rt=nexpura-review-2026' },
  { filename: 'MIG-13-repair-detail.png', path: '/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026' },
  { filename: 'MIG-14-bespoke-list.png', path: '/bespoke?rt=nexpura-review-2026' },
  { filename: 'MIG-15-bespoke-detail.png', path: '/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026' },
  { filename: 'MIG-16-invoices-list.png', path: '/invoices?rt=nexpura-review-2026' },
  { filename: 'MIG-17-invoice-detail-paid.png', path: '/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026' },
  { filename: 'MIG-18-invoice-detail-partial.png', path: '/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026' },
  { filename: 'MIG-19-suppliers-list.png', path: '/suppliers?rt=nexpura-review-2026' },
  { filename: 'MIG-20-supplier-detail.png', path: '/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026' },
];

const OUTDIR = '/tmp/nexpura-screenshots';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uploadFile(filename, buffer) {
  return new Promise((resolve, reject) => {
    const uploadPath = `${PREFIX}${filename}`;
    const url = new URL(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${uploadPath}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Content-Length': buffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function verifyUrl(filename) {
  return new Promise((resolve, reject) => {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}${filename}`;
    const url = new URL(publicUrl);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'HEAD',
    };

    const req = https.request(options, (res) => {
      resolve({ status: res.statusCode, url: publicUrl });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUTDIR)) {
    fs.mkdirSync(OUTDIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  for (const shot of SCREENSHOTS) {
    const url = `${BASE_URL}${shot.path}`;
    console.log(`\n📸 Taking screenshot: ${shot.filename}`);
    console.log(`   URL: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(2000);

      const outPath = path.join(OUTDIR, shot.filename);
      await page.screenshot({ path: outPath, fullPage: false });
      
      const buffer = fs.readFileSync(outPath);
      const sizeKB = (buffer.length / 1024).toFixed(1);
      console.log(`   ✅ Screenshot saved: ${sizeKB} KB`);

      // Upload to Supabase
      const uploadResult = await uploadFile(shot.filename, buffer);
      console.log(`   📤 Upload status: ${uploadResult.status} - ${uploadResult.body}`);

      results.push({
        filename: shot.filename,
        url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}${shot.filename}`,
        sizeKB,
        uploadStatus: uploadResult.status,
      });
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      results.push({
        filename: shot.filename,
        error: err.message,
      });
    }
  }

  await browser.close();

  // Verify all URLs
  console.log('\n\n🔍 Verifying public URLs...');
  for (const result of results) {
    if (!result.error) {
      const verify = await verifyUrl(result.filename);
      result.verifyStatus = verify.status;
      console.log(`   ${verify.status === 200 ? '✅' : '❌'} ${result.filename}: ${verify.status}`);
    }
  }

  // Content checks using vision on saved screenshots
  console.log('\n\n📊 RESULTS SUMMARY:');
  console.log('==================');
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.filename}: ERROR - ${r.error}`);
    } else {
      console.log(`✅ ${r.filename}: ${r.sizeKB} KB | Upload: ${r.uploadStatus} | Verify: ${r.verifyStatus}`);
      console.log(`   URL: ${r.url}`);
    }
  }

  // Save results to JSON
  fs.writeFileSync('/tmp/nexpura-screenshots/results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ All done! Results saved to /tmp/nexpura-screenshots/results.json');
}

main().catch(console.error);
