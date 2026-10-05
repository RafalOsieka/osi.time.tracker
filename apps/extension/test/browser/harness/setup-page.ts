import type { Locator, Page } from 'playwright';

/** Transient outcome notifications (Nuxt UI toasts) on an extension page. */
export function toasts(page: Page): Locator {
  return page.locator('ol[data-slot="viewport"]');
}

/**
 * Waits until the setup page has finished its current approval change. Uses a Playwright wait
 * instead of `expect.poll`, so `beforeAll` hooks can call it too.
 */
export async function waitUntilIdle(page: Page): Promise<void> {
  await page.locator('main:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
}
