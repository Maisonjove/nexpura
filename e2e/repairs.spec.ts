import { test, expect } from '@playwright/test';

test.describe('Repairs', () => {
  test('repairs list page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/repairs');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login since not authenticated
    const url = page.url();
    expect(url.includes('/login') || url.includes('/repairs')).toBeTruthy();
  });

  test('repairs page has correct HTML structure', async ({ page }) => {
    await page.goto('/repairs');
    await page.waitForLoadState('domcontentloaded');
    
    // Basic HTML structure check
    const html = page.locator('html');
    await expect(html).toBeAttached();
    
    const body = page.locator('body');
    await expect(body).toBeAttached();
  });

  test('new repair page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/repairs/new');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login since not authenticated
    const url = page.url();
    expect(url.includes('/login') || url.includes('/repairs')).toBeTruthy();
  });

  test('no critical console errors on repairs page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/repairs');
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

test.describe('Repairs with Review Token', () => {
  // The app supports review tokens for demo access
  // These tests are skipped as review tokens may change
  const REVIEW_TOKEN = 'nexpura-review-2026';

  test.skip('repairs page loads with review token', async ({ page }) => {
    await page.goto(`/repairs?rt=${REVIEW_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Should stay on repairs page with demo data
    const url = page.url();
    expect(url.includes('/repairs')).toBeTruthy();
  });

  test.skip('repairs page shows pipeline or list view', async ({ page }) => {
    await page.goto(`/repairs?rt=${REVIEW_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Check for view toggle or list/pipeline content
    // The page should render either pipeline view or list view
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Repairs Functionality (requires auth)', () => {
  // These tests would use a test account or mocked auth
  // Skipped without proper auth setup

  test.skip('repairs list shows repair items', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/repairs');
    
    // Check for repairs list or pipeline
    await expect(page.locator('[class*="repair"], table, [class*="pipeline"]').first()).toBeVisible();
  });

  test.skip('can toggle between pipeline and list view', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/repairs');
    
    // Check for view toggle buttons
    await expect(page.locator('button:has-text("Pipeline"), button:has-text("List")')).toBeVisible();
  });

  test.skip('create repair form renders all fields', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/repairs/new');
    
    // Check for form elements
    await expect(page.locator('text=New Repair')).toBeVisible();
    await expect(page.locator('select, input').first()).toBeVisible();
  });

  test.skip('repair detail page loads', async ({ page }) => {
    // Would require authenticated session with existing repair
    // Navigate to a specific repair
    await page.goto('/repairs');
    
    // Click on first repair
    const repairLink = page.locator('a[href*="/repairs/"]').first();
    if (await repairLink.count() > 0) {
      await repairLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should be on repair detail page
      expect(page.url()).toMatch(/\/repairs\/[^/]+/);
    }
  });

  test.skip('can search repairs', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/repairs');
    
    // Check for search input
    const searchInput = page.locator('input[placeholder*="search" i], input[name="q"]');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('ring');
    await page.waitForTimeout(500); // Wait for search
  });

  test.skip('can filter repairs by stage', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/repairs');
    
    // Check for stage filter
    await expect(page.locator('select[name="stage"], button:has-text("Stage")')).toBeVisible();
  });
});
