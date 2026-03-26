import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login.*/);
    
    // Check for Nexpura branding
    await expect(page.locator('text=Nexpura')).toBeVisible();
    
    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/.*signup.*/);
    
    // Check for Nexpura branding
    await expect(page.locator('text=Nexpura')).toBeVisible();
    
    // Check for plan selection (step 1)
    await expect(page.locator('text=Choose your plan')).toBeVisible();
    
    // Check for plan cards (use getByRole to avoid strict mode issues)
    await expect(page.getByRole('heading', { name: 'Boutique' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Studio' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Atelier' })).toBeVisible();
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword123');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for error message (API call + render)
    // Look specifically for the login error element
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 10000 });
  });

  test('signup form validation - step navigation', async ({ page }) => {
    await page.goto('/signup');
    
    // Step 1: Select a plan
    await expect(page.locator('text=Choose your plan')).toBeVisible();
    
    // Click on Boutique plan button
    await page.click('button:has-text("Select Boutique")');
    
    // Should move to step 2 (subdomain)
    await expect(page.locator('text=Choose your subdomain')).toBeVisible({ timeout: 5000 });
    
    // Check subdomain input is visible
    await expect(page.locator('input[placeholder="your-store"]')).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    
    // Check for Nexpura branding
    await expect(page.locator('text=Nexpura')).toBeVisible();
    
    // Check for forgot password content
    await expect(page.locator('text=Forgot your password?')).toBeVisible();
    
    // Check for email input
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Check for submit button
    await expect(page.locator('button:has-text("Send reset link")')).toBeVisible();
    
    // Check for back to login link
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('login page has remember me checkbox', async ({ page }) => {
    await page.goto('/login');
    
    // Check for remember me checkbox
    await expect(page.locator('input[type="checkbox"]#remember-me')).toBeVisible();
    await expect(page.locator('text=Remember me')).toBeVisible();
  });

  test('login page has Google OAuth button', async ({ page }) => {
    await page.goto('/login');
    
    // Check for Google sign-in button
    await expect(page.locator('button:has-text("Continue with Google")')).toBeVisible();
  });

  test('login page links to signup', async ({ page }) => {
    await page.goto('/login');
    
    // Check for signup link
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
    await expect(page.locator('text=Sign up free')).toBeVisible();
  });

  test('signup page links to login', async ({ page }) => {
    await page.goto('/signup');
    
    // Check for login link
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(page.locator('text=Sign in')).toBeVisible();
  });
});
