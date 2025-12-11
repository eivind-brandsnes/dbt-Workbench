import { test, expect } from '@playwright/test';

test('Run History page should display the heading', async ({ page }) => {
  await page.goto('/run-history');
  await page.screenshot({ path: 'run-history.png' });
  await expect(page.locator('h1')).toHaveText('Run History');
});
