const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://nexpura-2ap5wtdng-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';

const screenshots = [
  { name: 'MIG-01-hub-home', path: '/migration?rt=nexpura-review-2026' },
  { name: 'MIG-02-source-selection', path: '/migration/new?rt=nexpura-review-2026' },
  { name: 'MIG-03-files-classified', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/files?rt=nexpura-review-2026' },
  { name: 'MIG-04-mapping', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/mapping?rt=nexpura-review-2026' },
  { name: 'MIG-05-preview', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/preview?rt=nexpura-review-2026' },
  { name: 'MIG-06-results-main', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026' },
  { name: 'MIG-07-results-expansion', path: '/migration/3fa58809-05a6-493b-8435-e99d92cc7aaf/results?rt=nexpura-review-2026' },
  { name: 'MIG-08-customers-list', path: '/customers?rt=nexpura-review-2026' },
  { name: 'MIG-09-customer-detail', path: '/customers/407dbb82-a57d-456e-a893-352171735a57?rt=nexpura-review-2026' },
  { name: 'MIG-10-inventory-list', path: '/inventory?rt=nexpura-review-2026' },
  { name: 'MIG-11-inventory-detail', path: '/inventory/af4eb6c4-22c1-4e0f-873d-a38bf9a26be4?rt=nexpura-review-2026' },
  { name: 'MIG-12-repairs-list', path: '/repairs?rt=nexpura-review-2026' },
  { name: 'MIG-13-repair-detail', path: '/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026' },
  { name: 'MIG-14-bespoke-list', path: '/bespoke?rt=nexpura-review-2026' },
  { name: 'MIG-15-bespoke-detail', path: '/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026' },
  { name: 'MIG-16-invoices-list', path: '/invoices?rt=nexpura-review-2026' },
  { name: 'MIG-17-invoice-detail-paid', path: '/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026' },
  { name: 'MIG-18-invoice-detail-partial', path: '/invoices/ddc3bdfe-b2c3-4f64-a9d3-e16f6266f406?rt=nexpura-review-2026' },
  { name: 'MIG-19-suppliers-list', path: '/suppliers?rt=nexpura-review-2026' },
  { name: 'MIG-20-supplier-detail', path: '/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uploadToSupabase(filename, pngBuffer) {
  return new Promise((resolve, reject) => {
    const storagePath = `screenshots/migration/${filename}.png`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
    const urlObj = new URL(uploadUrl);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Content-Length': pngBuffer.length,
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
    req.write(pngBuffer);
    req.end();
  });
}

function checkPublicUrl(filename) {
  return new Promise((resolve, reject) => {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/screenshots/migration/${filename}.png`;
    const urlObj = new URL(publicUrl);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
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
  const tmpDir = '/tmp/nexpura-screenshots';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  for (const shot of screenshots) {
    const url = `${BASE_URL}${shot.path}`;
    console.log(`\n[${shot.name}] Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(1500);

      const filePath = path.join(tmpDir, `${shot.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`  ✓ Screenshot saved: ${filePath}`);

      const pngBuffer = fs.readFileSync(filePath);
      const uploadResult = await uploadToSupabase(shot.name, pngBuffer);
      console.log(`  ✓ Upload status: ${uploadResult.status} - ${uploadResult.body}`);

      results.push({ name: shot.name, uploadStatus: uploadResult.status });
    } catch (err) {
      console.error(`  ✗ Error for ${shot.name}: ${err.message}`);
      results.push({ name: shot.name, uploadStatus: 'ERROR', error: err.message });
    }
  }

  await browser.close();

  console.log('\n\n=== VERIFICATION ===\n');
  const verifyResults = [];
  for (const r of results) {
    if (r.uploadStatus === 200 || r.uploadStatus === 200) {
      try {
        const check = await checkPublicUrl(r.name);
        console.log(`${check.status === 200 ? '✅' : '❌'} ${r.name}: ${check.status} → ${check.url}`);
        verifyResults.push({ ...r, verifyStatus: check.status, publicUrl: check.url });
      } catch (err) {
        console.log(`❌ ${r.name}: verification error - ${err.message}`);
        verifyResults.push({ ...r, verifyStatus: 'ERROR' });
      }
    } else {
      console.log(`⚠️  ${r.name}: skipped verification (upload failed with ${r.uploadStatus})`);
      verifyResults.push({ ...r, verifyStatus: 'SKIPPED' });
    }
  }

  console.log('\n\n=== FINAL REPORT ===\n');
  for (const r of verifyResults) {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/screenshots/migration/${r.name}.png`;
    console.log(`${r.verifyStatus === 200 ? '✅' : '❌'} ${r.name}`);
    console.log(`   Public URL: ${publicUrl}`);
    console.log(`   Upload: ${r.uploadStatus} | Verify: ${r.verifyStatus}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
