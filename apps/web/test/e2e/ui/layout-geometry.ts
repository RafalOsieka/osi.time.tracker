import { expect } from 'vitest';
import type { Locator, Page } from 'playwright';

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error(`Missing geometry for ${locator}`);
  return result;
}

export async function expectStartEdgesEqual(first: Locator, second: Locator) {
  expect(Math.abs((await box(first)).x - (await box(second)).x)).toBeLessThanOrEqual(1);
}

export async function expectTextStartsAtColumn(header: Locator, control: Locator) {
  const { x, padding } = await control.evaluate((element) => ({
    x: element.getBoundingClientRect().x,
    padding: Number.parseFloat(getComputedStyle(element).paddingInlineStart) || 0,
  }));
  expect(Math.abs((await box(header)).x - x - padding)).toBeLessThanOrEqual(1);
}

export async function expectEndEdgesEqual(first: Locator, second: Locator) {
  const a = await box(first);
  const b = await box(second);
  expect(Math.abs(a.x + a.width - b.x - b.width)).toBeLessThanOrEqual(1);
}

export async function columnWidths(columns: Locator) {
  const widths: number[] = [];
  for (const column of await columns.all()) widths.push((await box(column)).width);
  return widths;
}

// The panel body scrolls and clips, so the document width alone misses list overflow:
// also require every cell to end inside the viewport.
export async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll('[role="cell"], [role="rowheader"]')]
      .filter((cell) => cell.getBoundingClientRect().right > innerWidth + 1)
      .map((cell) => cell.textContent?.trim().slice(0, 40) ?? ''),
  );
  expect(overflowing).toEqual([]);
}
