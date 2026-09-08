import { existsSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  extensionDistPath,
  launchExtensionContext,
  type ExtensionHarness,
} from './harness/extension-context.js';
import { requireChromium } from './harness/skip.js';

const describeChromium = requireChromium();

async function optionsUrl(harness: ExtensionHarness): Promise<string> {
  const workers = harness.context.serviceWorkers();
  const worker =
    workers[0] ?? (await harness.context.waitForEvent('serviceworker', { timeout: 15_000 }));
  const extensionId = new URL(worker.url()).host;
  return `chrome-extension://${extensionId}/src/options/index.html`;
}

describeChromium('extension options UI', () => {
  let harness: ExtensionHarness | undefined;

  beforeAll(async () => {
    expect(existsSync(extensionDistPath())).toBe(true);
    harness = await launchExtensionContext();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it('approves, reloads, localizes, and revokes from the keyboard', async () => {
    const page = await harness!.context.newPage();
    await page.goto(await optionsUrl(harness!));
    await page.getByTestId('website-origin').fill('http://localhost:3000');
    await page.getByTestId('add-website').press('Enter');
    await expect(page.getByTestId('status')).toContainText(/saved|zapisane/i);

    await page.reload();
    await expect(page.getByText('http://localhost:3000')).toBeVisible();

    await page.getByTestId('language').selectOption('pl');
    await expect(page.getByTestId('add-website')).toHaveText(/Zatwierdź/i);

    await page.getByTestId('destination-url').fill('https://tracker.example.com');
    await page.getByTestId('add-destination').press('Enter');
    await page.locator('[data-testid^="revoke-website-"]').press('Enter');
    await expect(page.getByTestId('status')).toContainText(/cofni|revoked/i);
  });
});
