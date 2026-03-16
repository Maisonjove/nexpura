const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://nexpura-2qdko6ysm-maisonjoves-projects.vercel.app';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';

const screenshots = [
  { name: 'MIG-01-hub-home.png', path: '/migration?rt=nexpura-review-2026' },
  { name: 'MIG-02-source-selection.png', path: '/migration/new?rt=nexpura-review-2026' },
  { name: 'MIG-03-files-classified.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/files?rt=nexpura-review-2026' },
  { name: 'MIG-04-mapping.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/mapping?rt=nexpura-review-2026' },
  { name: 'MIG-05-preview.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/preview?rt=nexpura-review-2026' },
  { name: 'MIG-06-results-main.png', path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/results?rt=nexpura-review-2026' },
  { name: 'MIG-07-results-expansion.png', path: '/migration/3fa58809-05a6-493b-8435-e99d92cc7aaf/results?rt=nexpura-review-2026' },
  { name: 'MIG-08-customers-list.png', path: '/customers?rt=nexpura-review-2026' },
  { name: 'MIG-09-customer-detail.png', path: '/customers/407dbb82-a57d-456e-a893-352171735a57?rt=nexpura-review-2026' },
  { name: 'MIG-10-inventory-list.png', path: '/inventory?rt=nexpura-review-2026' },
  { name: 'MIG-11-inventory-detail.png', path: '/inventory/af4eb6c4-22c1-4e0f-873d-a38bf9a26be4?rt=nexpura-review-2026' },
  { name: 'MIG-12-repairs-list.png', path: '/repairs?rt=nexpura-review-2026' },
  { name: 'MIG-13-repair-detail.png', path: '/repairs/99be1bc2-a54f-4dbe-b03f-3f1fc504cb75?rt=nexpura-review-2026' },
  { name: 'MIG-14-bespoke-list.png', path: '/bespoke?rt=nexpura-review-2026' },
  { name: 'MIG-15-bespoke-detail.png', path: '/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026' },
  { name: 'MIG-16-invoices-list.png', path: '/invoices?rt=nexpura-review-2026' },
  { name: 'MIG-17-invoice-detail-paid.png', path: '/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026' },
  { name: 'MIG-18-invoice-detail-partial.png', path: '/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026' },
  { name: 'MIG-19-suppliers-list.png', path: '/suppliers?rt=nexpura-review-2026' },
  { name: 'MIG-20-supplier-detail.png', path: '/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026' },
];

const OUTPUT_DIR = path.join(__dirname, 'migration-screenshots');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(filename, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}/${filename}`;
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Content-Length': fileBuffer.length,
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

async function verifyFile(filename) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/${filename}`;
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const results = [];

  for (const shot of screenshots) {
    const fullUrl = `${BASE_URL}${shot.path}`;
    const outputPath = path.join(OUTPUT_DIR, shot.name);
    
    console.log(`\nCapturing: ${shot.name}`);
    console.log(`  URL: ${fullUrl}`);
    
    const page = await context.newPage();
    
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(2000);
      await page.screenshot({ path: outputPath, fullPage: false });
      
      const stats = fs.statSync(outputPath);
      console.log(`  Captured: ${stats.size} bytes`);
      
      // Upload
      console.log(`  Uploading...`);
      const uploadResult = await uploadFile(shot.name, outputPath);
      console.log(`  Upload status: ${uploadResult.status}`);
      
      // Verify
      console.log(`  Verifying...`);
      const verifyStatus = await verifyFile(shot.name);
      console.log(`  Verify status: ${verifyStatus}`);
      
      results.push({
        name: shot.name,
        size: stats.size,
        uploadStatus: uploadResult.status,
        verifyStatus: verifyStatus,
      });
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({
        name: shot.name,
        size: 0,
        uploadStatus: 'ERROR',
        verifyStatus: 'ERROR',
        error: err.message,
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n\n=== REPORT ===');
  console.log('filename | size | upload status | verify status');
  console.log('---------|------|---------------|---------------');
  for (const r of results) {
    console.log(`${r.name} | ${r.size} | ${r.uploadStatus} | ${r.verifyStatus}${r.error ? ' | ERROR: ' + r.error : ''}`);
  }
  
  console.log('\nAll screenshots taken from: ' + BASE_URL);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
