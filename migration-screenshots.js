const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');
const path = require('path');

const BASE_URL = 'https://nexpura-jpcm378js-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration/';

const screenshots = [
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
  { filename: 'MIG-18-invoice-detail-partial.png', path: '/invoices/ddc3bdfe-b2c3-4f64-a9d3-e16f6266f406?rt=nexpura-review-2026' },
  { filename: 'MIG-19-suppliers-list.png', path: '/suppliers?rt=nexpura-review-2026' },
  { filename: 'MIG-20-supplier-detail.png', path: '/suppliers/27d404df-c2b4-45f1-8dff-76c859307ffc?rt=nexpura-review-2026' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uploadToSupabase(filename, buffer) {
  return new Promise((resolve, reject) => {
    const uploadPath = PREFIX + filename;
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${uploadPath}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Content-Length': buffer.length,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function verifyPublicUrl(filename) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}${filename}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      res.resume(); // drain
      resolve(res.statusCode);
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const outDir = '/tmp/mig-screenshots';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  for (const shot of screenshots) {
    const fullUrl = BASE_URL + shot.path;
    console.log(`\n📸 Capturing: ${shot.filename}`);
    console.log(`   URL: ${fullUrl}`);
    
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(1500);
      
      // Get page title/content for validation
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log(`   Title: ${title}`);
      
      const filepath = path.join(outDir, shot.filename);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`   ✅ Screenshot taken`);
      
      // Upload
      const buffer = fs.readFileSync(filepath);
      await uploadToSupabase(shot.filename, buffer);
      console.log(`   ✅ Uploaded to Supabase`);
      
      // Verify
      const statusCode = await verifyPublicUrl(shot.filename);
      console.log(`   ✅ Verified: HTTP ${statusCode}`);
      
      results.push({
        filename: shot.filename,
        url: fullUrl,
        title,
        bodySnippet: bodyText.substring(0, 200),
        uploadOk: true,
        verifyStatus: statusCode,
      });
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      results.push({
        filename: shot.filename,
        url: fullUrl,
        error: err.message,
        uploadOk: false,
      });
    }
  }

  await browser.close();

  console.log('\n\n========== SUMMARY ==========');
  for (const r of results) {
    if (r.uploadOk) {
      console.log(`✅ ${r.filename} — HTTP ${r.verifyStatus}`);
      if (r.bodySnippet) console.log(`   Content: ${r.bodySnippet.replace(/\n/g, ' ').substring(0, 150)}`);
    } else {
      console.log(`❌ ${r.filename} — ${r.error}`);
    }
  }

  // Special checks
  console.log('\n========== SPECIAL CHECKS ==========');
  const bespoke = results.find(r => r.filename === 'MIG-15-bespoke-detail.png');
  if (bespoke && bespoke.bodySnippet) {
    const hasAbigail = bespoke.bodySnippet.includes('Abigail') || bespoke.bodySnippet.includes('Young');
    console.log(`Bespoke detail "Abigail Young": ${hasAbigail ? '✅ Found' : '⚠️ NOT FOUND in first 200 chars (may be further down)'}`);
  }

  const invoicePaid = results.find(r => r.filename === 'MIG-17-invoice-detail-paid.png');
  if (invoicePaid && invoicePaid.bodySnippet) {
    const hasPaid = invoicePaid.bodySnippet.toLowerCase().includes('paid');
    console.log(`Invoice paid detail "Paid": ${hasPaid ? '✅ Found' : '⚠️ NOT FOUND in first 200 chars'}`);
  }

  const invoicePartial = results.find(r => r.filename === 'MIG-18-invoice-detail-partial.png');
  if (invoicePartial && invoicePartial.bodySnippet) {
    const hasPartial = invoicePartial.bodySnippet.toLowerCase().includes('partial') || invoicePartial.bodySnippet.toLowerCase().includes('balance');
    console.log(`Invoice partial detail: ${hasPartial ? '✅ Found' : '⚠️ NOT FOUND in first 200 chars'}`);
  }

  const invoiceList = results.find(r => r.filename === 'MIG-16-invoices-list.png');
  if (invoiceList && invoiceList.bodySnippet) {
    const hasDraft = invoiceList.bodySnippet.toLowerCase().includes('draft');
    const hasPaidOrSent = invoiceList.bodySnippet.toLowerCase().includes('paid') || invoiceList.bodySnippet.toLowerCase().includes('sent') || invoiceList.bodySnippet.toLowerCase().includes('partial');
    console.log(`Invoice list - Draft labels: ${hasDraft ? '⚠️ HAS DRAFT' : '✅ No Draft'}, Paid/Sent/Partial: ${hasPaidOrSent ? '✅ Found' : '⚠️ NOT FOUND'}`);
  }
}

run().catch(console.error);
