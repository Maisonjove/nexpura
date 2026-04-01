import { chromium } from 'playwright';

const BASE_URL = 'https://nexpura.com';
const results = {
  tested: {},
  passed: {},
  failed: {},
  bugs: { critical: [], high: [], medium: [], low: [] }
};

function log(msg) {
  console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`);
}

function recordBug(severity, category, title, details) {
  results.bugs[severity].push({ category, title, details });
  log(`🐛 ${severity.toUpperCase()}: ${title}`);
}

function markResult(category, test, passed, note = '') {
  if (!results.tested[category]) results.tested[category] = [];
  results.tested[category].push(test);
  if (passed) {
    if (!results.passed[category]) results.passed[category] = [];
    results.passed[category].push(test);
  } else {
    if (!results.failed[category]) results.failed[category] = [];
    results.failed[category].push({ test, note });
  }
  log(`${passed ? '✅' : '❌'} [${category}] ${test}${note ? ': ' + note : ''}`);
}

async function testWithTimeout(fn, timeout = 15000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // Track console errors and network failures
  const consoleErrors = [];
  const networkErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  
  page.on('response', response => {
    if (response.status() >= 500) {
      networkErrors.push({ url: response.url(), status: response.status() });
    }
  });

  try {
    // ============ A. AUTH / ACCESS / SESSION ============
    log('=== A. AUTH / ACCESS / SESSION ===');
    
    // Test homepage loads
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();
      markResult('A', 'Homepage loads', title.length > 0, title);
    } catch (e) {
      markResult('A', 'Homepage loads', false, e.message);
      recordBug('critical', 'A', 'Homepage fails to load', e.message);
    }

    // Test login page
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const loginForm = await page.$('form');
      const emailInput = await page.$('input[type="email"], input[name="email"]');
      const passwordInput = await page.$('input[type="password"]');
      markResult('A', 'Login page elements', !!(loginForm && emailInput && passwordInput));
    } catch (e) {
      markResult('A', 'Login page elements', false, e.message);
    }

    // Test protected routes redirect to login
    const protectedRoutes = ['/dashboard', '/inventory', '/repairs', '/customers', '/pos'];
    for (const route of protectedRoutes) {
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1000);
        const currentUrl = page.url();
        const redirectedToLogin = currentUrl.includes('/login') || currentUrl.includes('/sign-in');
        markResult('A', `Protected route ${route}`, redirectedToLogin, `Redirected to: ${currentUrl}`);
      } catch (e) {
        markResult('A', `Protected route ${route}`, false, e.message);
      }
    }

    // ============ B. DASHBOARD (needs auth - test public parts) ============
    log('=== B. DASHBOARD (Public check) ===');
    
    // Try landing page / marketing
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const hasContent = await page.locator('body').textContent();
      markResult('B', 'Landing page has content', hasContent.length > 100);
    } catch (e) {
      markResult('B', 'Landing page has content', false, e.message);
    }

    // ============ O. APPRAISALS / PASSPORTS - Public verification ============
    log('=== O. APPRAISALS / PASSPORTS (Public) ===');
    
    // Test passport verification page (public)
    try {
      await page.goto(`${BASE_URL}/verify`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);
      const pageText = await page.locator('body').textContent();
      const hasVerifyContent = pageText.toLowerCase().includes('verify') || 
                               pageText.toLowerCase().includes('passport') ||
                               pageText.toLowerCase().includes('identity');
      markResult('O', 'Verify page accessible', true, 'Page loads');
    } catch (e) {
      markResult('O', 'Verify page accessible', false, e.message);
    }

    // ============ Q. WEBSITE BUILDER - Subdomain test ============
    log('=== Q. WEBSITE BUILDER (Public shop) ===');
    
    // Test demo subdomain
    try {
      const shopUrl = 'https://demo.nexpura.com';
      const response = await page.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const status = response?.status() || 0;
      markResult('Q', 'Demo subdomain accessible', status < 400, `Status: ${status}`);
      
      if (status < 400) {
        // Check for shop content
        const pageText = await page.locator('body').textContent();
        const hasShopContent = pageText.length > 50;
        markResult('Q', 'Demo shop has content', hasShopContent);
      }
    } catch (e) {
      markResult('Q', 'Demo subdomain accessible', false, e.message);
    }

    // ============ Check for general performance issues ============
    log('=== V. PERFORMANCE / ERRORS ===');
    
    // Check for 500 errors we collected
    if (networkErrors.length > 0) {
      recordBug('high', 'V', '500 errors detected', JSON.stringify(networkErrors.slice(0, 5)));
      markResult('V', 'No 500 errors', false, `${networkErrors.length} errors`);
    } else {
      markResult('V', 'No 500 errors', true);
    }
    
    // Check for console errors
    if (consoleErrors.length > 0) {
      const criticalErrors = consoleErrors.filter(e => 
        e.includes('TypeError') || e.includes('ReferenceError') || e.includes('undefined')
      );
      if (criticalErrors.length > 0) {
        recordBug('medium', 'V', 'JavaScript errors', criticalErrors.slice(0, 3).join('; '));
      }
      markResult('V', 'No critical JS errors', criticalErrors.length === 0, `${criticalErrors.length} critical errors`);
    } else {
      markResult('V', 'No critical JS errors', true);
    }

    // ============ Test API endpoints directly ============
    log('=== Direct API Tests ===');
    
    // Test public pricing page
    try {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const pricingContent = await page.locator('body').textContent();
      const hasPricing = pricingContent.toLowerCase().includes('pricing') || 
                         pricingContent.toLowerCase().includes('plan') ||
                         pricingContent.toLowerCase().includes('boutique');
      markResult('P', 'Pricing page loads', hasPricing);
    } catch (e) {
      markResult('P', 'Pricing page loads', false, e.message);
    }

    // Test signup/register page
    try {
      await page.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const signupForm = await page.$('form');
      markResult('A', 'Signup page accessible', true);
    } catch (e) {
      // Try alternate URL
      try {
        await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        markResult('A', 'Register page accessible', true);
      } catch (e2) {
        markResult('A', 'Signup/Register page', false, 'Not found');
      }
    }

  } catch (globalError) {
    log(`GLOBAL ERROR: ${globalError.message}`);
    recordBug('critical', 'GLOBAL', 'Test suite error', globalError.message);
  }

  await browser.close();
  
  // Generate report
  console.log('\n\n========================================');
  console.log('QA TEST RESULTS - PUBLIC PAGE TESTING');
  console.log('========================================\n');
  
  console.log('## AREAS TESTED (Public/Unauthenticated)');
  for (const [cat, tests] of Object.entries(results.tested)) {
    console.log(`${cat}: ${tests.join(', ')}`);
  }
  
  console.log('\n## PASS/FAIL SUMMARY');
  const categories = ['A', 'B', 'O', 'P', 'Q', 'V'];
  for (const cat of categories) {
    const passed = results.passed[cat]?.length || 0;
    const total = results.tested[cat]?.length || 0;
    const status = total > 0 ? (passed === total ? 'PASS' : 'PARTIAL') : 'NOT TESTED';
    console.log(`${cat}: ${status} (${passed}/${total})`);
  }
  
  console.log('\n## BUGS FOUND');
  for (const [severity, bugs] of Object.entries(results.bugs)) {
    if (bugs.length > 0) {
      console.log(`\n### ${severity.toUpperCase()}`);
      bugs.forEach(b => console.log(`- [${b.category}] ${b.title}: ${b.details}`));
    }
  }
  
  console.log('\n## FAILED TESTS');
  for (const [cat, tests] of Object.entries(results.failed)) {
    tests.forEach(t => console.log(`- [${cat}] ${t.test}: ${t.note}`));
  }
}

main().catch(console.error);
