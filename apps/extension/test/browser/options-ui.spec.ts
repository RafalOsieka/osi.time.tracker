import { existsSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import type { Page } from 'playwright';
import {
  extensionDistPath,
  launchExtensionContext,
  type ExtensionHarness,
} from './harness/extension-context.js';
import { requireChromium } from './harness/skip.js';

const describeChromium = requireChromium();

function optionsUrl(harness: ExtensionHarness): string {
  return `chrome-extension://${harness.extensionId}/src/options/index.html`;
}

async function waitUntilIdle(page: Page): Promise<void> {
  await expect
    .poll(() => page.getByTestId('status').textContent(), { timeout: 15_000 })
    .not.toMatch(/Updating approvals|Aktualizowanie zatwierdzeń/);
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

  afterEach(async () => {
    await Promise.all(harness!.context.pages().map((page) => page.close()));
  });

  it('approves, reloads, localizes, and revokes from the keyboard', async () => {
    const page = await harness!.context.newPage();
    await page.goto(optionsUrl(harness!));
    await page.getByTestId('language').selectOption('en');
    await expect.poll(() => page.getByTestId('add-destination').isDisabled()).toBe(true);
    await page.getByTestId('website-origin').fill('https://time.example.com/reports');
    await page.getByTestId('add-website').press('Enter');
    await expect
      .poll(() => page.getByTestId('website-origin').getAttribute('aria-invalid'))
      .toBe('true');
    await expect
      .poll(() => page.locator('#website-origin-error').textContent())
      .toMatch(/Remove paths/);
    await page.getByTestId('website-origin').fill('http://localhost:3000');
    await page.getByTestId('add-website').press('Enter');
    await expect.poll(() => page.getByTestId('status').textContent()).toMatch(/saved/i);

    await page.reload();
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3000').isVisible())
      .toBe(true);

    await page.getByTestId('language').selectOption('pl');
    await expect.poll(() => page.getByTestId('add-website').textContent()).toMatch(/Zatwierdź/i);
    await expect
      .poll(() => page.getByTestId('add-destination').textContent())
      .toMatch(/Zatwierdź tracker/i);
    await page.reload();
    await expect.poll(() => page.getByTestId('language').inputValue()).toBe('pl');
    const popup = await harness!.context.newPage();
    await popup.goto(optionsUrl(harness!).replace('/options/', '/popup/'));
    await expect
      .poll(() => popup.getByTestId('open-options').textContent())
      .toMatch(/Otwórz konfigurację/);

    await expect
      .poll(() => popup.getByTestId('saved-websites').textContent())
      .toContain('Zapisane witryny:');
    await expect
      .poll(() => popup.getByTestId('saved-websites').locator('li').allTextContents())
      .toEqual(['http://localhost:3000']);
    await page.getByTestId('destination-url').fill('https://tracker.example.com/team');
    await page.getByTestId('add-destination').press('Enter');
    await expect.poll(() => page.locator('[data-testid^="revoke-destination-"]').count()).toBe(1);
    await expect
      .poll(() => popup.getByTestId('saved-trackers').textContent())
      .toContain('Zapisane trackery:');
    await expect
      .poll(async () =>
        (await popup.getByTestId('saved-trackers').locator('li').allTextContents()).map((text) =>
          text.trim(),
        ),
      )
      .toEqual(['http://localhost:3000 - https://tracker.example.com/team']);
    await waitUntilIdle(page);
    await page.locator('[data-testid^="revoke-website-"]').press('Enter');
    await expect.poll(() => page.getByTestId('status').textContent()).toMatch(/cofni/i);
    await expect.poll(() => page.getByTestId('add-destination').isDisabled()).toBe(true);
    await expect
      .poll(() => popup.getByTestId('saved-websites').textContent())
      .toContain('Nie zatwierdzono jeszcze żadnej witryny.');
    await expect
      .poll(() => popup.getByTestId('saved-trackers').textContent())
      .toContain('Nie zatwierdzono jeszcze żadnego trackera.');

    await page.getByTestId('website-origin').fill('http://localhost:3001');
    await page.getByTestId('add-website').press('Enter');
    await expect
      .poll(() => page.getByTestId('destination-website').inputValue())
      .toBe('http://localhost:3001');
    await page.getByTestId('revoke-website-http://localhost:3001').click();
    await expect.poll(() => page.getByTestId('add-destination').isDisabled()).toBe(true);
  });

  it('synchronizes setup tabs, distinguishes destination identities, and restores lost browser access', async () => {
    const page = await harness!.context.newPage();
    const other = await harness!.context.newPage();
    const url = optionsUrl(harness!);
    await page.goto(url);
    await other.goto(url);
    await page.getByTestId('language').selectOption('en');
    await expect
      .poll(() => other.getByTestId('add-website').textContent())
      .toMatch(/Approve website/);
    for (const origin of ['http://localhost:3100', 'http://localhost:3101']) {
      await page.getByTestId('website-origin').fill(origin);
      await page.getByTestId('add-website').click();
      await expect.poll(() => other.getByTestId(`revoke-website-${origin}`).isVisible()).toBe(true);
      await page.getByTestId('destination-website').selectOption(origin);
      await page.getByTestId('destination-provider').selectOption('redmine');
      await page.getByTestId('destination-url').fill('https://shared.example.com/team');
      await page.getByTestId('add-destination').click();
      const row = other.getByTestId(
        `revoke-destination-${origin}|redmine|https://shared.example.com/team`,
      );
      await expect
        .poll(() => row.getAttribute('aria-label'))
        .toBe(`Revoke tracker Website: ${origin} — Redmine https://shared.example.com/team`);
    }
    let hostAccessRevoked = true;
    try {
      await other.evaluate(() =>
        chrome.permissions.remove({ origins: ['https://shared.example.com/*'] }),
      );
    } catch {
      // Required host_permissions in the headless test profile cannot be revoked.
      hostAccessRevoked = false;
    }
    if (hostAccessRevoked) {
      const restore = page.getByTestId(
        'restore-destination-http://localhost:3100|redmine|https://shared.example.com/team',
      );
      await expect.poll(() => restore.isVisible()).toBe(true);
      await restore.click();
      await expect
        .poll(() => page.locator('[data-testid^="restore-destination-"]').count())
        .toBe(0);
    }
    await waitUntilIdle(other);
    await other.getByTestId('revoke-website-http://localhost:3100').click();
    await expect
      .poll(() => page.getByTestId('destination-website').inputValue())
      .toBe('http://localhost:3101');
    await waitUntilIdle(other);
    await other.getByTestId('revoke-website-http://localhost:3101').click();
    await waitUntilIdle(other);
    await expect.poll(() => page.locator('[data-testid^="revoke-destination-"]').count()).toBe(0);
  });

  it('shows saved approvals after bridge failure and retries registration explicitly', async () => {
    const page = await harness!.context.newPage();
    await page.goto(optionsUrl(harness!));
    await page.getByTestId('language').selectOption('en');
    const registration = await page.evaluateHandle(() => {
      const register = chrome.scripting.registerContentScripts.bind(chrome.scripting);
      chrome.scripting.registerContentScripts = async (scripts) => {
        throw new Error(`Registration failed for ${scripts.length} scripts`);
      };
      return register;
    });
    await page.getByTestId('website-origin').fill('http://localhost:3200');
    await page.getByTestId('add-website').click();
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3200').isVisible())
      .toBe(true);
    await expect
      .poll(() => page.getByTestId('status').textContent())
      .toMatch(/bridge could not be configured/);
    await page.evaluate((register) => {
      chrome.scripting.registerContentScripts = register;
    }, registration);
    await registration.dispose();
    await page.getByTestId('retry-setup').click();
    await expect.poll(() => page.getByTestId('retry-setup').count()).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await chrome.scripting.getRegisteredContentScripts()).some(
            (script) => script.id === 'osi-bridge:http://localhost:3200',
          ),
        ),
      )
      .toBe(true);
    await page.getByTestId('revoke-website-http://localhost:3200').click();
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3200').count())
      .toBe(0);
  });
});
