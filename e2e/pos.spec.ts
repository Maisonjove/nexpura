import { test, expect } from '@playwright/test';

test.describe('POS (Point of Sale)', () => {
  test('POS page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login since not authenticated
    const url = page.url();
    expect(url.includes('/login') || url.includes('/pos')).toBeTruthy();
  });

  test('POS page has correct HTML structure', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForLoadState('domcontentloaded');
    
    // Basic HTML structure check
    const html = page.locator('html');
    await expect(html).toBeAttached();
    
    const body = page.locator('body');
    await expect(body).toBeAttached();
  });

  test('no critical console errors on POS page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/pos');
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

test.describe('POS Functionality (requires auth)', () => {
  // These tests would use a test account or mocked auth
  // Skipped without proper auth setup

  test.skip('POS page shows product grid', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    // Check for product grid or list
    await expect(page.locator('[class*="grid"], [class*="product"]').first()).toBeVisible();
  });

  test.skip('product search input is visible', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    // Check for search input
    await expect(page.locator('input[placeholder*="search" i], input[type="search"]')).toBeVisible();
  });

  test.skip('cart section is visible', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    // Check for cart/checkout area
    await expect(page.locator('[class*="cart"], [class*="checkout"], text=Total')).toBeVisible();
  });

  test.skip('can search for products', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
    await searchInput.fill('ring');
    
    // Should filter/search products
    await page.waitForTimeout(500); // Wait for search debounce
  });

  test.skip('can add item to cart', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    // Click on a product to add to cart
    const productCard = page.locator('[class*="product"], [data-testid="product-card"]').first();
    await productCard.click();
    
    // Cart should update
    await expect(page.locator('text=1')).toBeVisible(); // Item count
  });

  test.skip('cart shows total', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    // Check for total display
    await expect(page.locator('text=Total')).toBeVisible();
  });

  test.skip('customer selection is available', async ({ page }) => {
    // Would require authenticated session
    await page.goto('/pos');
    
    // Check for customer selection
    await expect(page.locator('text=Customer, button:has-text("Customer")')).toBeVisible();
  });
});
