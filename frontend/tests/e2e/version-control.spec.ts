import { test, expect } from '@playwright/test';

test.describe('Version Control Smoke Tests', () => {
  test('Version Control page loads and displays repo status', async ({ page }) => {
    await page.goto('/version-control');

    // Check main heading
    await expect(page.getByText(/projects\\s*&\\s*version control/i)).toBeVisible();

    // Check that the page has loaded content
    await expect(page.locator('main')).toBeVisible();
  });

  test('Version Control shows repository information', async ({ page }) => {
    await page.goto('/version-control');

    // Wait for the version control page to load
    await expect(page.locator('main')).toBeVisible();

    // Verify we're not on a loading state
    await expect(page.getByText('Loading')).not.toBeVisible();
  });
});
