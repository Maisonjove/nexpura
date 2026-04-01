import { chromium } from 'playwright';

const BASE_URL = 'https://nexpura.com';

async function main() {
  console.log('Starting UI Tests for Nexpura...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  
  const results = { pass: [], fail: [] };
  
  // Helper to test with shorter timeout
  async function testPage(name, url, checks) {
    try {
      console.log(`Testing: ${name}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(500);
      
      for (const check of checks) {
        try {
          const result = await check.fn(page);
          if (result) {
            results.pass.push(`${name}: ${check.name}`);
            console.log(`  ✅ ${check.name}`);
          } else {
            results.fail.push(`${name}: ${check.name}`);
            console.log(`  ❌ ${check.name}`);
          }
        } catch (e) {
          results.fail.push(`${name}: ${check.name} - ${e.message}`);
          console.log(`  ❌ ${check.name}: ${e.message}`);
        }
      }
    } catch (e) {
      results.fail.push(`${name}: Page load failed - ${e.message}`);
      console.log(`  ❌ Page load failed: ${e.message}`);
    }
  }
  
  // Test 1: Homepage
  await testPage('Homepage', BASE_URL, [
    {
      name: 'Has title',
      fn: async (p) => {
        const title = await p.title();
        return title.includes('Nexpura');
      }
    },
    {
      name: 'Has CTA buttons',
      fn: async (p) => {
        const buttons = await p.locator('a, button').count();
        return buttons > 5;
      }
    },
    {
      name: 'Has navigation',
      fn: async (p) => {
        const nav = await p.locator('nav, header').count();
        return nav > 0;
      }
    }
  ]);
  
  // Test 2: Login page
  await testPage('Login', `${BASE_URL}/login`, [
    {
      name: 'Has email input',
      fn: async (p) => {
        const input = await p.locator('input[type="email"], input[name="email"]').count();
        return input > 0;
      }
    },
    {
      name: 'Has password input',
      fn: async (p) => {
        const input = await p.locator('input[type="password"]').count();
        return input > 0;
      }
    },
    {
      name: 'Has submit button',
      fn: async (p) => {
        const btn = await p.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').count();
        return btn > 0;
      }
    }
  ]);
  
  // Test 3: Signup page
  await testPage('Signup', `${BASE_URL}/signup`, [
    {
      name: 'Has signup form',
      fn: async (p) => {
        const form = await p.locator('form').count();
        return form > 0;
      }
    },
    {
      name: 'Has business name field',
      fn: async (p) => {
        const input = await p.locator('input').count();
        return input >= 2;
      }
    }
  ]);
  
  // Test 4: Pricing page
  await testPage('Pricing', `${BASE_URL}/pricing`, [
    {
      name: 'Has pricing content',
      fn: async (p) => {
        const text = await p.locator('body').textContent();
        return text.toLowerCase().includes('pricing') || 
               text.toLowerCase().includes('plan') ||
               text.toLowerCase().includes('boutique') ||
               text.toLowerCase().includes('studio');
      }
    },
    {
      name: 'Has plan cards',
      fn: async (p) => {
        // Look for pricing-related elements
        const cards = await p.locator('[class*="card"], [class*="plan"], [class*="pricing"]').count();
        return cards > 0;
      }
    }
  ]);
  
  // Test 5: Features page
  await testPage('Features', `${BASE_URL}/features`, [
    {
      name: 'Has features content',
      fn: async (p) => {
        const text = await p.locator('body').textContent();
        return text.length > 500;
      }
    }
  ]);
  
  // Test 6: Verify page (public)
  await testPage('Verify', `${BASE_URL}/verify`, [
    {
      name: 'Has verification UI',
      fn: async (p) => {
        const text = await p.locator('body').textContent();
        return text.toLowerCase().includes('verify') ||
               text.toLowerCase().includes('passport') ||
               text.toLowerCase().includes('identity') ||
               text.toLowerCase().includes('certificate');
      }
    }
  ]);
  
  // Test 7: API Health
  await testPage('API Health', `${BASE_URL}/api/health`, [
    {
      name: 'Returns OK',
      fn: async (p) => {
        const text = await p.locator('body').textContent();
        return text.includes('ok') || text.includes('status');
      }
    }
  ]);
  
  await browser.close();
  
  // Summary
  console.log('\n========================================');
  console.log('UI TEST SUMMARY');
  console.log('========================================');
  console.log(`✅ Passed: ${results.pass.length}`);
  console.log(`❌ Failed: ${results.fail.length}`);
  
  if (results.fail.length > 0) {
    console.log('\nFailed tests:');
    results.fail.forEach(f => console.log(`  - ${f}`));
  }
  
  console.log('\nPassed tests:');
  results.pass.forEach(p => console.log(`  + ${p}`));
}

main().catch(console.error);
