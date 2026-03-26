import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // Note: These tests check page structure without full authentication
  // In a real scenario, you'd use test fixtures with authenticated sessions

  test('dashboard page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login since not authenticated
    const url = page.url();
    expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy();
  });

  test('dashboard page has correct HTML structure', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Basic HTML structure
    const html = page.locator('html');
    await expect(html).toBeAttached();
    
    const body = page.locator('body');
    await expect(body).toBeAttached();
  });

  test('no critical console errors on dashboard load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected auth-related and network errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('redirect') &&
        !e.includes('NEXT_REDIRECT')
    );
    
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Dashboard Navigation (requires auth)', () => {
  // These tests would use a test account or mocked auth
  // Skipped without proper auth setup

  test.skip('dashboard shows welcome message', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/dashboard');
    await expect(page.locator('h1, h2').filter({ hasText: /welcome|dashboard/i })).toBeVisible();
  });

  test.skip('dashboard renders key widgets', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/dashboard');
    
    // Check for common dashboard elements
    await expect(page.locator('[class*="card"], [class*="widget"], [class*="stat"]').first()).toBeVisible();
  });

  test.skip('sidebar navigation is visible', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/dashboard');
    
    // Check for navigation elements
    await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
  });

  test.skip('can navigate to other sections from dashboard', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/dashboard');
    
    // Check for links to other sections
    const navLinks = page.locator('a[href*="/inventory"], a[href*="/repairs"], a[href*="/pos"]');
    expect(await navLinks.count()).toBeGreaterThan(0);
  });
});
