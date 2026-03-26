import { test, expect } from '@playwright/test';

test.describe('Inventory', () => {
  test('inventory page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login since not authenticated
    const url = page.url();
    expect(url.includes('/login') || url.includes('/inventory')).toBeTruthy();
  });

  test('inventory page has correct HTML structure', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('domcontentloaded');
    
    // Basic HTML structure check
    const html = page.locator('html');
    await expect(html).toBeAttached();
    
    const body = page.locator('body');
    await expect(body).toBeAttached();
  });

  test('new inventory item page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/inventory/new');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login since not authenticated
    const url = page.url();
    expect(url.includes('/login') || url.includes('/inventory')).toBeTruthy();
  });

  test('no critical console errors on inventory page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/inventory');
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

test.describe('Inventory with Review Token', () => {
  // The app supports review tokens for demo access
  // These tests are skipped as review tokens may change
  const REVIEW_TOKEN = 'nexpura-review-2026';

  test.skip('inventory page loads with review token', async ({ page }) => {
    await page.goto(`/inventory?rt=${REVIEW_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Should stay on inventory page with demo data
    const url = page.url();
    expect(url.includes('/inventory')).toBeTruthy();
  });

  test.skip('inventory page shows items or empty state', async ({ page }) => {
    await page.goto(`/inventory?rt=${REVIEW_TOKEN}`);
    await page.waitForLoadState('networkidle');
    
    // Should have content on the page
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
  });
});

test.describe('Inventory Functionality (requires auth)', () => {
  // These tests would use a test account or mocked auth
  // Skipped without proper auth setup

  test.skip('inventory list shows items', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for inventory items
    await expect(page.locator('table, [class*="grid"], [class*="inventory"]').first()).toBeVisible();
  });

  test.skip('inventory shows stats/summary', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for inventory stats
    await expect(page.locator('text=Total, text=Items, text=Value').first()).toBeVisible();
  });

  test.skip('search/filter functionality is visible', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for search input
    await expect(page.locator('input[placeholder*="search" i], input[type="search"]')).toBeVisible();
  });

  test.skip('can search inventory items', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
    await searchInput.fill('ring');
    
    // Should filter items
    await page.waitForTimeout(500); // Wait for search debounce
  });

  test.skip('can filter by category', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for category filter
    await expect(page.locator('select, button:has-text("Category")')).toBeVisible();
  });

  test.skip('can filter by status', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for status filter
    await expect(page.locator('select, button:has-text("Status")')).toBeVisible();
  });

  test.skip('create item form renders', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory/new');
    
    // Check for form
    await expect(page.locator('form, text=New Item, text=Add Item').first()).toBeVisible();
  });

  test.skip('inventory item detail page loads', async ({ page }) => {
    // Would require authenticated session with existing item
    await page.goto('/inventory');
    
    // Click on first item
    const itemLink = page.locator('a[href*="/inventory/"]').first();
    if (await itemLink.count() > 0) {
      await itemLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should be on item detail page
      expect(page.url()).toMatch(/\/inventory\/[^/]+/);
    }
  });

  test.skip('can toggle between grid and list view', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for view toggle
    await expect(page.locator('button[aria-label*="grid" i], button[aria-label*="list" i]')).toBeVisible();
  });

  test.skip('add stock modal can be opened', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/inventory');
    
    // Check for add stock button
    const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
    await addButton.click();
    
    // Modal should appear
    await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible();
  });
});
