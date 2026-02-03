import { test, expect } from '@playwright/test';

test('Plugins page loads and shows adapters', async ({ page }) => {
    // Go to plugins page
    await page.goto('/plugins/installed');

    // Check header
    await expect(page.getByRole('heading', { name: 'Installed Plugins' })).toBeVisible();

    // Check Adapter Suggestions section
    await expect(page.getByRole('heading', { name: 'dbt Adapters' })).toBeVisible();

    // Check table headers (adapter table only)
    const adapterTable = page.getByRole('table').first();
    await expect(adapterTable.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(adapterTable.getByRole('columnheader', { name: 'Package' })).toBeVisible();
    await expect(adapterTable.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // Wait for loading to finish - tolerate absence of loading indicator
    await expect(page.getByText(/loading plugins/i)).toBeHidden();
});
