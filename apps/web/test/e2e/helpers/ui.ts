import type { Page } from 'playwright-core';

/**
 * Fill the login form and wait until the authenticated shell is visible.
 */
export async function loginAs(
  page: Page,
  email: string,
  password = 'secret',
  options: { width?: number; height?: number } = {},
): Promise<Page> {
  await page.setViewportSize({
    width: options.width ?? 1280,
    height: options.height ?? 800,
  });
  await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
  await page
    .locator('[data-testid="password"] input, [data-testid="password"]')
    .first()
    .fill(password);
  await page.click('[data-testid="login-button"]');
  await page.waitForSelector('[data-testid="app-topbar"]');
  return page;
}
