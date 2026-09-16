import type { Page } from 'playwright-core';

/**
 * Types an `HH:mm` time into a segmented `TimeField` (Nuxt UI `UInputTime`)
 * addressed by `data-testid`, by focusing each segment via its `data-segment`
 * part and typing its digits. Matches the shared-ui-components segmented
 * clock-time field contract (REQ-361).
 *
 * For a range field (two sets of hour/minute segments under the same
 * `data-testid`), `index` selects which one: `0` for the start, `1` for the
 * end.
 */
export async function typeTimeField(
  page: Page,
  testId: string,
  hhMm: string,
  index = 0,
): Promise<void> {
  const [hour, minute] = hhMm.split(':');
  if (!hour || !minute) throw new Error(`typeTimeField: invalid "HH:mm" value "${hhMm}"`);

  const field = page.locator(`[data-testid="${testId}"]`);
  await field.locator('[data-segment="hour"]').nth(index).click();
  await page.keyboard.type(hour, { delay: 20 });
  await field.locator('[data-segment="minute"]').nth(index).click();
  await page.keyboard.type(minute, { delay: 20 });
}
