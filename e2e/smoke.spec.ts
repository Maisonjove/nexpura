import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    
    // Should show login form elements
    await expect(page).toHaveURL(/.*login.*/);
    
    // Check for common login page elements
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    
    // At least one of these should exist on a login page
    const hasLoginForm = (await emailInput.count()) > 0 || (await passwordInput.count()) > 0;
    expect(hasLoginForm || (await page.title()).toLowerCase().includes('login')).toBeTruthy();
  });

  test('home page redirects or loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Home page should either load or redirect to login
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    // Should be on home page or redirected to login/dashboard
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
    
    // Basic HTML structure checks
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
    
    // Filter out expected errors (like auth redirects)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('401') &&
        !e.includes('403')
    );
    
    // Should have no critical console errors
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Navigation Tests', () => {
  test('can navigate to register page if exists', async ({ page }) => {
    await page.goto('/login');
    
    // Look for register/signup link
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
    
    // Should have some form of navigation or branding
    const hasLogo = (await page.locator('img[alt*="logo" i], [class*="logo" i], a[href="/"]').count()) > 0;
    const hasForm = (await page.locator('form, [role="form"]').count()) > 0;
    const hasButtons = (await page.locator('button').count()) > 0;
    
    // At minimum, should have some interactive elements
    expect(hasLogo || hasForm || hasButtons).toBeTruthy();
  });
});

test.describe('Authenticated Pages (if auth bypass available)', () => {
  // These tests are designed to be skipped if no auth is available
  // They serve as templates for when auth is configured
  
  test.skip('dashboard loads after auth', async ({ page }) => {
    // This would require setting up auth cookies/tokens
    await page.goto('/dashboard');
    await expect(page.locator('h1, [class*="dashboard"]')).toBeVisible();
  });

  test.skip('POS page loads', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    // POS page specific checks
  });
});
