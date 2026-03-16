const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

const BASE_URL = 'https://nexpura-kfbmho7ky-maisonjoves-projects.vercel.app';
const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const BUCKET = 'verification';
const PREFIX = 'screenshots/migration';
const OUTPUT_DIR = '/tmp/mig-screenshots';

const shots = [
  { file: 'MIG-10-inventory-list.png', path: '/inventory?rt=nexpura-review-2026' },
  { file: 'MIG-16-invoices-list.png', path: '/invoices?rt=nexpura-review-2026' },
];

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
      res.on('end', () => resolve({ status: res.statusCode, body }));
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
    const options = { hostname: urlObj.hostname, path: urlObj.pathname, method: 'GET' };
    const req = https.request(options, (res) => {
      resolve({ status: res.statusCode, url: publicUrl });
      res.resume();
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const shot of shots) {
    const fullUrl = BASE_URL + shot.path;
    const localPath = `${OUTPUT_DIR}/${shot.file}`;
    console.log(`\n📸 Navigating to: ${fullUrl}`);
    try {
      // Use load instead of networkidle for pages that never fully settle
      await page.goto(fullUrl, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: localPath, fullPage: false });
      const stat = fs.statSync(localPath);
      console.log(`   ✅ Screenshot saved: ${shot.file} (${stat.size} bytes)`);
      const uploadResult = await uploadFile(localPath, shot.file);
      console.log(`   ⬆️  Upload status: ${uploadResult.status}`);
      const verifyResult = await verifyUrl(shot.file);
      console.log(`   🔍 Verify status: ${verifyResult.status}`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  await browser.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
