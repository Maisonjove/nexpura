const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://nexpura-h75sngbvm-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';

const RETRY_SCREENSHOTS = [
  { filename: 'MIG-10-inventory-list.png', path: '/inventory?rt=nexpura-review-2026' },
  { filename: 'MIG-16-invoices-list.png', path: '/invoices?rt=nexpura-review-2026' },
  { filename: 'MIG-19-suppliers-list.png', path: '/suppliers?rt=nexpura-review-2026' },
];

const OUTPUT_DIR = path.join(__dirname, 'screenshots-migration');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadToSupabase(filePath, filename) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const uploadPath = `${PREFIX}/${filename}`;
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${uploadPath}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
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

async function verifyUpload(filename) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/${filename}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'HEAD',
    };

    const req = https.request(options, (res) => {
      resolve({ status: res.statusCode });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // First navigate with auth to establish session
  console.log('Establishing auth session...');
  await page.goto(`${BASE_URL}/migration?rt=nexpura-review-2026`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  for (const shot of RETRY_SCREENSHOTS) {
    const url = `${BASE_URL}${shot.path}`;
    const filePath = path.join(OUTPUT_DIR, shot.filename);
    
    console.log(`Taking screenshot: ${shot.filename}`);
    console.log(`  URL: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(5000); // longer wait for data to load
      await page.screenshot({ path: filePath, fullPage: false });
      
      const fileSize = fs.statSync(filePath).size;
      console.log(`  Captured: ${fileSize} bytes`);
      
      console.log(`  Uploading to Supabase...`);
      const uploadResult = await uploadToSupabase(filePath, shot.filename);
      console.log(`  Upload status: ${uploadResult.status}`);
      
      const verifyResult = await verifyUpload(shot.filename);
      console.log(`  Verify status: ${verifyResult.status}`);
      
      console.log(`RESULT ${shot.filename}: size=${fileSize} upload=${uploadResult.status} verify=${verifyResult.status}`);
    } catch (err) {
      console.error(`  ERROR for ${shot.filename}: ${err.message}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
