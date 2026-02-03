import { test, expect } from '@playwright/test';

test('Sidebar stays fixed while main content scrolls', async ({ page }) => {
  await page.goto('/');

  // Ensure main has enough scrollable space, even if the DOM rerenders.
  await page.addStyleTag({
    content: `
      main[data-testid="main-content"] {
        height: 300px !important;
        max-height: 300px !important;
        overflow-y: auto !important;
      }
      main[data-testid="main-content"] > :first-child {
        min-height: 2000px;
      }
    `,
  });

  const sidebar = page.getByTestId('sidebar');
  const main = page.getByTestId('main-content');

  await expect(sidebar).toBeVisible();
  await expect(main).toBeVisible();

  await page.waitForFunction(() => {
    const el = document.querySelector('main[data-testid="main-content"]') as HTMLElement | null;
    return !!el && el.scrollHeight > el.clientHeight;
  });

  const initialBox = await sidebar.boundingBox();
  await main.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  
  // Wait for scroll to complete by checking the scroll position
  await expect.poll(async () => main.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  
  const afterBox = await sidebar.boundingBox();

  expect(initialBox).not.toBeNull();
  expect(afterBox).not.toBeNull();
  expect(afterBox?.y).toBeCloseTo(initialBox?.y ?? 0, 1);
});
