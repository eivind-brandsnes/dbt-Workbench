import { test, expect } from '@playwright/test'

test.describe('SQL Workspace Smoke Tests', () => {
  test('loads DBeaver-style workbench chrome and supports tab interactions', async ({ page }) => {
    await page.goto('/sql')

    await expect(page.getByRole('heading', { name: /sql workspace/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Run$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /New SQL Tab/i })).toBeVisible()

    await page.getByRole('button', { name: /New SQL Tab/i }).click()
    await expect(page.locator('[role="tab"]').first()).toBeVisible()

    await page.getByRole('tab', { name: /Output/i }).click()
    await expect(page.getByText(/Execution output/i)).toBeVisible()
  })

  test('shows collapsible navigator on narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/sql')

    await expect(page.getByRole('button', { name: /show navigator/i })).toBeVisible()
    await page.getByRole('button', { name: /show navigator/i }).click()
    await expect(page.getByText(/Project Navigator/i)).toBeVisible()
  })
})
