import { waitForHydration } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';

/**
 * Reload the current page and wait for Nuxt hydration. Use instead of `page.reload()`:
 * it returns as soon as the server-rendered markup is visible, and clicks on that
 * markup before hydration are silently lost (or submit forms natively).
 */
export async function reloadHydrated(page: Page): Promise<void> {
  await page.reload();
  await waitForHydration(page, page.url(), 'hydration');
}

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
