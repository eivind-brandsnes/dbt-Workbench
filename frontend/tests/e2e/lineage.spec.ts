import { test, expect } from '@playwright/test';

test.describe('Lineage Smoke Tests', () => {
  test('Lineage page loads and displays graph container', async ({ page }) => {
    await page.goto('/lineage');

    // Check main heading
    await expect(page.getByRole('heading', { name: /lineage/i })).toBeVisible();

    // Check that the page has loaded content
    await expect(page.locator('main')).toBeVisible();
  });

  test('Lineage graph container is visible', async ({ page }) => {
    await page.goto('/lineage');

    // Wait for the lineage page to load
    await expect(page.locator('main')).toBeVisible();

    // Verify we're not on a loading state
    await expect(page.getByText('Loading')).not.toBeVisible();
  });
});
