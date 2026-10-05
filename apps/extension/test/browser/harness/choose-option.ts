import type { Page } from 'playwright';

/** Opens a Nuxt UI select by its test id and picks the option with the given accessible name. */
export async function chooseOption(page: Page, testId: string, name: string | RegExp) {
  await page.getByTestId(testId).click();
  // Playwright ignores `exact` for a RegExp name, so strings match whole and patterns as written.
  await page.getByRole('option', { name, exact: true }).click();
}

/** Accessible option names that do not depend on the current UI language. */
export const optionNames = {
  en: /^(English|angielski)$/,
  pl: /^(Polish|polski)$/,
  dark: /^(Dark|Ciemny)$/,
  light: /^(Light|Jasny)$/,
  openproject: 'OpenProject',
  redmine: 'Redmine',
} as const;
