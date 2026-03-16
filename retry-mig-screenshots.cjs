// retry-mig-screenshots.cjs - retry failed screenshots + content checks
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://nexpura-d23aumliv-maisonjoves-projects.vercel.app';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';

// Only the 4 that failed
const RETRY_SHOTS = [
  { file: 'MIG-02-source-selection.png',      path: '/migration/new?rt=nexpura-review-2026' },
  { file: 'MIG-03-files-classified.png',      path: '/migration/0042042d-515d-458c-8640-7d78f490c13d/files?rt=nexpura-review-2026' },
  { file: 'MIG-10-inventory-list.png',        path: '/inventory?rt=nexpura-review-2026' },
  { file: 'MIG-16-invoices-list.png',         path: '/invoices?rt=nexpura-review-2026' },
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
    const options = { hostname: urlObj.hostname, path: urlObj.pathname, method: 'GET' };
    const req = https.request(options, (res) => {
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
  console.log('Launching browser for retries...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const results = [];
  
  for (const shot of RETRY_SHOTS) {
    const fullUrl = `${BASE_URL}${shot.path}`;
    const outPath = path.join(OUTDIR, shot.file);
    
    console.log(`\n[→] ${shot.file}`);
    
    try {
      // Use 'load' instead of 'networkidle' for pages that have long-polling/websockets
      await page.goto(fullUrl, { waitUntil: 'load', timeout: 60000 });
      await sleep(4000); // extra wait for JS rendering
      await page.screenshot({ path: outPath, fullPage: false });
      
      const size = fs.statSync(outPath).size;
      console.log(`    Screenshot: ${size} bytes`);
      
      const uploadResult = await uploadFile(shot.file, outPath);
      console.log(`    Upload: ${uploadResult.status}`);
      
      const verifyStatus = await verifyFile(shot.file);
      console.log(`    Verify: ${verifyStatus}`);
      
      results.push({ file: shot.file, size, uploadStatus: uploadResult.status, verifyStatus, ok: true });
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      // Try with domcontentloaded
      try {
        console.log('    Retrying with domcontentloaded...');
        await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(5000);
        await page.screenshot({ path: outPath, fullPage: false });
        
        const size = fs.statSync(outPath).size;
        console.log(`    Screenshot (fallback): ${size} bytes`);
        
        const uploadResult = await uploadFile(shot.file, outPath);
        console.log(`    Upload: ${uploadResult.status}`);
        
        const verifyStatus = await verifyFile(shot.file);
        console.log(`    Verify: ${verifyStatus}`);
        
        results.push({ file: shot.file, size, uploadStatus: uploadResult.status, verifyStatus, ok: true });
      } catch (err2) {
        console.error(`    FATAL: ${err2.message}`);
        results.push({ file: shot.file, size: 0, uploadStatus: 'ERROR', verifyStatus: 'ERROR', ok: false, error: err2.message });
      }
    }
  }
  
  await context.close();
  await browser.close();
  
  // Content checks
  console.log('\n\n=== CONTENT CHECKS ===');
  
  const browser2 = await chromium.launch({ headless: true });
  const ctx2 = await browser2.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  
  const contentChecks = {};
  
  // MIG-15
  await page2.goto(`${BASE_URL}/bespoke/64cf8499-ef28-480a-b19e-f8ce23da9b07?rt=nexpura-review-2026`, { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  const mig15text = await page2.content();
  contentChecks['MIG-15'] = mig15text.includes('Abigail Young') ? 'PASS - "Abigail Young" found' : 'FAIL - "Abigail Young" NOT found';
  console.log(`MIG-15: ${contentChecks['MIG-15']}`);
  
  // MIG-16
  await page2.goto(`${BASE_URL}/invoices?rt=nexpura-review-2026`, { waitUntil: 'load', timeout: 60000 });
  await sleep(4000);
  const mig16text = await page2.content();
  const hasDraft = mig16text.includes('Draft');
  const hasPaid = mig16text.includes('Paid');
  const hasSent = mig16text.includes('Sent');
  const hasPartial = mig16text.includes('Partial');
  contentChecks['MIG-16'] = `${!hasDraft ? 'PASS' : 'WARN'} - Draft:${hasDraft} Paid:${hasPaid} Sent:${hasSent} Partial:${hasPartial}`;
  console.log(`MIG-16: ${contentChecks['MIG-16']}`);
  
  // MIG-17
  await page2.goto(`${BASE_URL}/invoices/4f9ed582-16f1-49d4-8309-173020be976e?rt=nexpura-review-2026`, { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  const mig17text = await page2.content();
  const mig17inv = mig17text.includes('INV-MIG-002');
  const mig17paid = mig17text.includes('Paid');
  const mig17amount = mig17text.includes('4,200') || mig17text.includes('4200');
  contentChecks['MIG-17'] = `${mig17inv && mig17paid && mig17amount ? 'PASS' : 'FAIL'} - INV-MIG-002:${mig17inv} Paid:${mig17paid} $4200:${mig17amount}`;
  console.log(`MIG-17: ${contentChecks['MIG-17']}`);
  
  // MIG-18
  await page2.goto(`${BASE_URL}/invoices/d0b794d5-2c03-4198-9257-090aba7157c5?rt=nexpura-review-2026`, { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  const mig18text = await page2.content();
  const mig18inv = mig18text.includes('INV-MIG-004');
  const mig18partial = mig18text.includes('Partial');
  const mig18amount = mig18text.includes('200') && mig18text.includes('450');
  contentChecks['MIG-18'] = `${mig18inv && mig18partial && mig18amount ? 'PASS' : 'FAIL'} - INV-MIG-004:${mig18inv} Partial:${mig18partial} $200/$450:${mig18amount}`;
  console.log(`MIG-18: ${contentChecks['MIG-18']}`);
  
  await ctx2.close();
  await browser2.close();
  
  // Summary
  console.log('\n\n=== RETRY RESULTS ===');
  for (const r of results) {
    const status = r.ok ? '✅' : '❌';
    console.log(`${status} ${r.file} | ${r.size} bytes | upload:${r.uploadStatus} | verify:${r.verifyStatus}`);
  }
  
  console.log('\nContent Checks:');
  for (const [k, v] of Object.entries(contentChecks)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
