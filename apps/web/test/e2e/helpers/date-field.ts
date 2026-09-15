import type { Page } from 'playwright-core';

/**
 * Types an ISO `YYYY-MM-DD` date into a Nuxt UI `UInputDate` field addressed
 * by `data-testid`, by focusing each segment via its `data-segment` part and
 * typing its digits. Locale-order independent since segments are targeted by
 * part, not by visual position, matching the shared-ui-components date-field
 * contract (REQ-359).
 *
 * For a range field (two sets of day/month/year segments under the same
 * `data-testid`), `index` selects which one: `0` for the start, `1` for the
 * end.
 */
export async function typeDateField(
  page: Page,
  testId: string,
  isoDate: string,
  index = 0,
): Promise<void> {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) throw new Error(`typeDateField: invalid ISO date "${isoDate}"`);

  const field = page.locator(`[data-testid="${testId}"]`);
  await field.locator('[data-segment="day"]').nth(index).click();
  await page.keyboard.type(day, { delay: 20 });
  await field.locator('[data-segment="month"]').nth(index).click();
  await page.keyboard.type(month, { delay: 20 });
  await field.locator('[data-segment="year"]').nth(index).click();
  await page.keyboard.type(year, { delay: 20 });
}
