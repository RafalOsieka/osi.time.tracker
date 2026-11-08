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

/**
 * Shows the setup page's website or tracker form. Each is open while its list is empty and folds
 * behind its "Add" button once something is listed.
 */
export async function openAddForm(page: Page, form: 'website' | 'destination'): Promise<void> {
  const field = page.getByTestId(form === 'website' ? 'website-origin' : 'destination-url');
  const opener = page.getByTestId(`new-${form}`);
  await field.or(opener).first().waitFor({ timeout: 15_000 });
  if (await opener.isVisible()) await opener.click();
  await field.waitFor();
}
