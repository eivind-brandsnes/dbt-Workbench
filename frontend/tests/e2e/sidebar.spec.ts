import { test, expect } from '@playwright/test';

test('Sidebar stays fixed while main content scrolls', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    spacer.setAttribute('data-testid', 'scroll-spacer');
    main.appendChild(spacer);
  });

  const sidebar = page.locator('aside');
  const main = page.locator('main');

  const initialBox = await sidebar.boundingBox();
  await main.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  
  // Wait for scroll to complete by checking the scroll position
  await expect(async () => {
    const scrollTop = await main.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  }).toPass();
  
  const afterBox = await sidebar.boundingBox();

  expect(initialBox).not.toBeNull();
  expect(afterBox).not.toBeNull();
  expect(afterBox?.y).toBeCloseTo(initialBox?.y ?? 0, 1);
});
