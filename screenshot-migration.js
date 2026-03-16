const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://nexpura-ooa0xtbuq-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';
const PATH_PREFIX = 'screenshots/migration';

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

const OUTPUT_DIR = '/tmp/nexpura-screenshots';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(filename, filePath) {
  const fileData = fs.readFileSync(filePath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PATH_PREFIX}/${filename}`;
  
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
        'Content-Length': fileData.length,
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function verifyFile(filename) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PATH_PREFIX}/${filename}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.resume();
      resolve({ status: res.statusCode });
    }).on('error', reject);
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
  const contentChecks = {};

  for (const shot of screenshots) {
    const url = `${BASE_URL}${shot.path}`;
    const outputPath = path.join(OUTPUT_DIR, shot.file);
    
    console.log(`Taking screenshot: ${shot.file} → ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(2000);
      
      // Content checks - get page HTML
      const html = await page.content();
      
      if (shot.file === 'MIG-15-bespoke-detail.png') {
        contentChecks['MIG-15'] = html.includes('Abigail Young') ? 'PASS' : 'FAIL - "Abigail Young" not found';
      }
      if (shot.file === 'MIG-16-invoices-list.png') {
        const hasDraftOnly = html.includes('Draft') && !html.includes('Paid') && !html.includes('Sent') && !html.includes('Partial');
        contentChecks['MIG-16'] = hasDraftOnly ? 'FAIL - only Draft found, no Paid/Sent/Partial' : 'PASS - Paid/Sent/Partial statuses present';
      }
      if (shot.file === 'MIG-17-invoice-detail-paid.png') {
        const hasInvNum = html.includes('INV-MIG-002');
        const hasPaid = html.includes('Paid');
        const hasAmount = html.includes('4,200') || html.includes('4200');
        contentChecks['MIG-17'] = (hasInvNum && hasPaid && hasAmount) ? 'PASS' : `FAIL - INV-MIG-002:${hasInvNum} Paid:${hasPaid} $4200:${hasAmount}`;
      }
      if (shot.file === 'MIG-18-invoice-detail-partial.png') {
        const hasInvNum = html.includes('INV-MIG-004');
        const hasPartial = html.includes('Partial');
        const has200 = html.includes('200');
        const has450 = html.includes('450');
        contentChecks['MIG-18'] = (hasInvNum && hasPartial && has200 && has450) ? 'PASS' : `FAIL - INV-MIG-004:${hasInvNum} Partial:${hasPartial} $200:${has200} $450:${has450}`;
      }
      
      await page.screenshot({ path: outputPath, fullPage: false });
      
      const fileSize = fs.statSync(outputPath).size;
      console.log(`  ✓ Screenshot saved: ${fileSize} bytes`);
      
      // Upload
      const uploadResult = await uploadFile(shot.file, outputPath);
      console.log(`  ✓ Upload status: ${uploadResult.status}`);
      
      // Verify
      const verifyResult = await verifyFile(shot.file);
      console.log(`  ✓ Verify status: ${verifyResult.status}`);
      
      results.push({
        file: shot.file,
        size: fileSize,
        uploadStatus: uploadResult.status,
        verifyStatus: verifyResult.status,
      });
    } catch (err) {
      console.error(`  ✗ Error for ${shot.file}: ${err.message}`);
      results.push({
        file: shot.file,
        size: 0,
        uploadStatus: 'ERROR',
        verifyStatus: 'ERROR',
        error: err.message,
      });
    }
  }

  await browser.close();

  // Print summary
  console.log('\n=== RESULTS SUMMARY ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('\n--- Screenshots ---');
  for (const r of results) {
    console.log(`${r.file}: size=${r.size}B upload=${r.uploadStatus} verify=${r.verifyStatus}${r.error ? ' ERROR:'+r.error : ''}`);
  }
  
  console.log('\n--- Content Checks ---');
  for (const [key, val] of Object.entries(contentChecks)) {
    console.log(`${key}: ${val}`);
  }
}

main().catch(console.error);
