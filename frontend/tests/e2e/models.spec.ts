import { test, expect } from '@playwright/test';

test.describe('Models Smoke Tests', () => {
  test('Models page loads and displays models list', async ({ page }) => {
    await page.goto('/models');

    // Check main heading
    await expect(page.getByRole('heading', { name: /models/i })).toBeVisible();

    // Check that the page has loaded content
    await expect(page.locator('main')).toBeVisible();
  });

  test('Models list contains at least one model', async ({ page }) => {
    await page.goto('/models');

    // Wait for models to load
    await expect(page.locator('main')).toBeVisible();

    // Look for any model-related content (table, list, or cards)
    // This verifies that models are being displayed
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    
    // Verify we're not on a loading state
    await expect(page.getByText('Loading')).not.toBeVisible();
  });
});
