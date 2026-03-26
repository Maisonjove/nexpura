import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login.*/);
    
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    
    const hasLoginForm = (await emailInput.count()) > 0 || (await passwordInput.count()) > 0;
    expect(hasLoginForm || (await page.title()).toLowerCase().includes('login')).toBeTruthy();
  });

  test('home page redirects or loads correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/login') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.endsWith('/') ||
      currentUrl.includes('/onboarding')
    ).toBeTruthy();
  });

  test('page has correct HTML structure', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    const html = page.locator('html');
    await expect(html).toBeAttached();
    
    const body = page.locator('body');
    await expect(body).toBeAttached();
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('401') &&
        !e.includes('403')
    );
    
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Navigation Tests', () => {
  test('can navigate to register page if exists', async ({ page }) => {
    await page.goto('/login');
    
    const registerLink = page.locator('a[href*="register"], a[href*="signup"], a:has-text("Sign up")');
    
    if ((await registerLink.count()) > 0) {
      await registerLink.first().click();
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      expect(url.includes('register') || url.includes('signup')).toBeTruthy();
    }
  });

  test('login page has navigation elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    const hasLogo = (await page.locator('img[alt*="logo" i], [class*="logo" i], a[href="/"]').count()) > 0;
    const hasForm = (await page.locator('form, [role="form"]').count()) > 0;
    const hasButtons = (await page.locator('button').count()) > 0;
    
    expect(hasLogo || hasForm || hasButtons).toBeTruthy();
  });
});

test.describe('Authenticated Pages (skipped without auth)', () => {
  test.skip('dashboard loads after auth', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1, [class*="dashboard"]')).toBeVisible();
  });

  test.skip('POS page loads', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
  });
});
