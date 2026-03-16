const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://nexpura-kfbmho7ky-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';

const screenshots = [
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

const OUTPUT_DIR = '/tmp/mig-screenshots';

function uploadFile(filePath, filename) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}/${filename}`;
    const urlObj = new URL(uploadUrl);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/png',
        'Content-Length': fileData.length,
        'x-upsert': 'true',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

function verifyUrl(filename) {
  return new Promise((resolve, reject) => {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/${filename}`;
    const urlObj = new URL(publicUrl);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      resolve({ status: res.statusCode, url: publicUrl });
      res.resume();
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  for (const shot of screenshots) {
    const fullUrl = BASE_URL + shot.path;
    const localPath = path.join(OUTPUT_DIR, shot.file);
    
    console.log(`\n📸 Navigating to: ${fullUrl}`);
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: localPath, fullPage: false });
      
      const stat = fs.statSync(localPath);
      console.log(`   ✅ Screenshot saved: ${shot.file} (${stat.size} bytes)`);

      // Upload
      const uploadResult = await uploadFile(localPath, shot.file);
      console.log(`   ⬆️  Upload status: ${uploadResult.status}`);

      // Verify
      const verifyResult = await verifyUrl(shot.file);
      console.log(`   🔍 Verify status: ${verifyResult.status}`);

      results.push({
        file: shot.file,
        size: stat.size,
        uploadStatus: uploadResult.status,
        verifyStatus: verifyResult.status,
        ok: uploadResult.status === 200 && verifyResult.status === 200,
      });
    } catch (err) {
      console.error(`   ❌ Error for ${shot.file}: ${err.message}`);
      results.push({
        file: shot.file,
        size: 0,
        uploadStatus: 'ERROR',
        verifyStatus: 'ERROR',
        ok: false,
        error: err.message,
      });
    }
  }

  await browser.close();

  console.log('\n\n=== SUMMARY ===');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.file} | ${r.size} bytes | upload:${r.uploadStatus} | verify:${r.verifyStatus}${r.error ? ' | ERROR: ' + r.error : ''}`);
  }

  // Content checks - read text from pages
  console.log('\n=== CONTENT CHECKS ===');
  console.log('Run with vision checks separately or inspect screenshots manually.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
