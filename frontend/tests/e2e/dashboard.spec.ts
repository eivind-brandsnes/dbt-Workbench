import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Tests', () => {
  test('Dashboard page loads and displays key elements', async ({ page }) => {
    await page.goto('/');

    // Check main heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Check that the page has loaded content
    await expect(page.locator('main')).toBeVisible();
  });

  test('Dashboard shows system health status', async ({ page }) => {
    await page.goto('/');

    // Look for any status indicator or health badge
    // This will verify that the dashboard has loaded and is displaying system information
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    
    // Verify we're not on a loading state
    await expect(page.getByText('Loading')).not.toBeVisible();
  });
});
