import { test, Page } from '@playwright/test';

const BASE = 'https://nexpura.com';

test('wrong password behavior', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('[class*=annot8]').forEach(e => (e as HTMLElement).style.setProperty('display', 'none', 'important'));
    setInterval(hide, 1000);
  });

  // Capture request timings + responses
  const reqs: Array<{ method: string; url: string; status?: number; ms?: number; start: number }> = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && /auth|login|token|action/i.test(req.url())) {
      reqs.push({ method: req.method(), url: req.url(), start: Date.now() });
    }
  });
  page.on('response', async (res) => {
    if (res.request().method() === 'POST') {
      const rec = reqs.find(r => r.url === res.url() && r.status === undefined);
      if (rec) { rec.status = res.status(); rec.ms = Date.now() - rec.start; }
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[type=email], input[name=email]').first().fill('Joeygermani11@icloud.com');
  await page.locator('input[type=password], input[name=password]').first().fill('definitely_wrong_password_12345');

  const clickStart = Date.now();
  await page.locator('form button[type=submit]').first().click();

  // Poll the UI every 500ms: track button text + error banner state
  const states: Array<{ t: number; btn: string; err: string }> = [];
  for (let s = 0; s < 40; s++) {
    await page.waitForTimeout(500);
    const btn = await page.locator('form button[type=submit]').first().innerText().catch(() => '?');
    const err = await page.locator('[role=alert]').innerText().catch(() => '');
    states.push({ t: Date.now() - clickStart, btn: btn.trim(), err: err.trim() });
    // bail if we hit a stable end state
    if (err && btn.toLowerCase() === 'sign in') break;
  }
  console.log('states:');
  for (const s of states) console.log(`  +${s.t}ms  btn="${s.btn}"  err="${s.err.slice(0, 80)}"`);
  await page.screenshot({ path: '/tmp/login_wrong.png', fullPage: true });

  console.log('\nnetwork:');
  for (const r of reqs) console.log(`  ${r.method} ${r.url.slice(0, 100)} → ${r.status ?? '(no response)'} in ${r.ms ?? '(pending)'}ms`);
});
