import { existsSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, expect, it } from 'vite-plus/test';
import type { Page } from 'playwright';
import {
  extensionDistPath,
  launchExtensionContext,
  type ExtensionHarness,
} from './harness/extension-context.js';
import { chooseOption, optionNames } from './harness/choose-option.js';
import { openAddForm, toasts, waitUntilIdle } from './harness/setup-page.js';
import { startWebsiteFixture } from './harness/website-fixture.js';
import { requireChromium } from './harness/skip.js';

const describeChromium = requireChromium();

function optionsUrl(harness: ExtensionHarness): string {
  return `chrome-extension://${harness.extensionId}/src/options/index.html`;
}

function popupUrl(harness: ExtensionHarness): string {
  return `chrome-extension://${harness.extensionId}/src/popup/index.html`;
}

/**
 * Records whether <html> is dark when parsing ends (readyState 'interactive'), which is after the
 * classic pre-paint script and before the page's module scripts mount Vue.
 */
function isDark(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}

async function recordThemeAtParse(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return;
      document.documentElement.dataset.darkAtParse = String(
        document.documentElement.classList.contains('dark'),
      );
    });
  });
}

/** Confirms the revoke dialog shown for a website that still has approved trackers. */
async function confirmRevoke(page: Page): Promise<void> {
  // Background tabs pause animations, and the dialog leaves the DOM only after its close animation.
  await page.bringToFront();
  await page.getByTestId('revoke-website-confirm-action').press('Enter');
  await expect.poll(() => page.getByRole('dialog').count()).toBe(0);
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

  it('loads the popup and setup page without any network request', async () => {
    const page = await harness!.context.newPage();
    const remote: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('chrome-extension://') && !url.startsWith('data:')) remote.push(url);
    });
    for (const url of [optionsUrl(harness!), popupUrl(harness!)]) {
      await page.goto(url, { waitUntil: 'networkidle' });
    }
    expect(remote).toEqual([]);
  });

  it('defaults to light under a dark OS and applies a chosen dark theme before paint', async () => {
    const page = await harness!.context.newPage();
    await page.emulateMedia({ colorScheme: 'dark' });
    await recordThemeAtParse(page);
    await page.goto(optionsUrl(harness!));
    await expect.poll(() => page.getByTestId('theme').isVisible()).toBe(true);
    expect(await isDark(page)).toBe(false);

    await chooseOption(page, 'theme', optionNames.dark);
    await expect.poll(() => isDark(page)).toBe(true);

    const popup = await harness!.context.newPage();
    await recordThemeAtParse(popup);
    await popup.goto(popupUrl(harness!));
    expect(await popup.locator('html').getAttribute('data-dark-at-parse')).toBe('true');
    await page.reload();
    expect(await page.locator('html').getAttribute('data-dark-at-parse')).toBe('true');

    await chooseOption(page, 'theme', optionNames.light);
    await expect.poll(() => isDark(popup)).toBe(false);
  });

  it('guides a fresh install with a checklist that disappears once setup is complete', async () => {
    const page = await harness!.context.newPage();
    await page.goto(optionsUrl(harness!));
    await chooseOption(page, 'language', optionNames.en);
    const popup = await harness!.context.newPage();
    await popup.goto(popupUrl(harness!));
    const step = (target: Page, id: string) =>
      target.getByTestId(`checklist-${id}`).getAttribute('data-state');

    for (const target of [page, popup]) {
      await expect.poll(() => step(target, 'website')).toBe('current');
      await expect.poll(() => step(target, 'tracker')).toBe('todo');
    }

    await page.bringToFront();
    await page.getByTestId('website-origin').fill('http://localhost:3300');
    await page.getByTestId('add-website').click();
    for (const target of [page, popup]) {
      await expect.poll(() => step(target, 'website')).toBe('done');
      await expect.poll(() => step(target, 'tracker')).toBe('current');
    }

    await page.getByTestId('destination-url').fill('https://tracker.example.com/checklist');
    await page.getByTestId('add-destination').click();
    for (const target of [page, popup]) {
      await expect.poll(() => target.getByTestId('setup-checklist').count()).toBe(0);
      expect(await target.locator('body').textContent()).not.toMatch(/Open Options/);
    }

    await waitUntilIdle(page);
    await page.getByTestId('revoke-website-http://localhost:3300').click();
    await confirmRevoke(page);
    await expect.poll(() => step(page, 'website')).toBe('current');
  });

  it('switches to an open website tab and opens trackers in a new tab', async () => {
    const fixture = await startWebsiteFixture();
    try {
      const page = await harness!.context.newPage();
      await page.goto(optionsUrl(harness!));
      await page.getByTestId('website-origin').fill(fixture.origin);
      await page.getByTestId('add-website').click();
      const websiteLink = page.getByTestId(`open-website-${fixture.origin}`);
      await websiteLink.waitFor();
      await waitUntilIdle(page);

      const website = await harness!.context.newPage();
      await website.goto(`${fixture.url}timer`);
      await page.bringToFront();
      const pagesBefore = harness!.context.pages().length;
      await websiteLink.click();
      await expect.poll(() => website.evaluate(() => document.visibilityState)).toBe('visible');
      expect(harness!.context.pages()).toHaveLength(pagesBefore);

      await website.close();
      const opened = harness!.context.waitForEvent('page');
      await page.bringToFront();
      await websiteLink.click();
      expect(new URL((await opened).url()).origin).toBe(fixture.origin);

      await page.getByTestId('destination-url').fill('https://tracker.example.com/links');
      await page.getByTestId('add-destination').click();
      const trackerLink = page.locator('[data-testid^="open-destination-"]');
      await trackerLink.waitFor();
      expect(await trackerLink.getAttribute('target')).toBe('_blank');
      expect(await trackerLink.getAttribute('href')).toBe('https://tracker.example.com/links');

      await waitUntilIdle(page);
      await page.getByTestId(`revoke-website-${fixture.origin}`).click();
      await confirmRevoke(page);
    } finally {
      await fixture.close();
    }
  });

  it('opens with the website the popup handed over, ready to approve', async () => {
    const page = await harness!.context.newPage();
    await page.goto(
      `${optionsUrl(harness!)}?website=${encodeURIComponent('http://localhost:3400')}`,
    );
    await chooseOption(page, 'language', optionNames.en);
    await expect
      .poll(() => page.getByTestId('website-origin').inputValue())
      .toBe('http://localhost:3400');
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
      .toBe('add-website');
    await page.keyboard.press('Enter');
    await page.getByTestId('revoke-website-http://localhost:3400').waitFor();

    // A denied permission prompt saves nothing and explains why.
    const denied = await harness!.context.newPage();
    await denied.addInitScript(() => {
      chrome.permissions.request = async () => false;
    });
    await denied.goto(
      `${optionsUrl(harness!)}?website=${encodeURIComponent('http://localhost:3401')}`,
    );
    await expect
      .poll(() => denied.evaluate(() => document.activeElement?.getAttribute('data-testid')))
      .toBe('add-website');
    await denied.keyboard.press('Enter');
    await expect
      .poll(() => denied.getByTestId('setup-error').textContent())
      .toMatch(/Permission was denied/);
    expect(await denied.getByTestId('revoke-website-http://localhost:3401').count()).toBe(0);

    await waitUntilIdle(page);
    await page.bringToFront();
    await page.getByTestId('revoke-website-http://localhost:3400').click();
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3400').count())
      .toBe(0);
  });

  it('shows the load error instead of the checklist when approvals cannot be read', async () => {
    const page = await harness!.context.newPage();
    await page.addInitScript(() => {
      chrome.storage.local.get = async () => {
        throw new Error('storage unavailable');
      };
    });
    await page.goto(optionsUrl(harness!));
    await expect.poll(() => page.getByTestId('retry-setup').isVisible()).toBe(true);
    expect(await page.getByTestId('setup-checklist').count()).toBe(0);
  });

  it('approves, reloads, localizes, and revokes from the keyboard', async () => {
    const page = await harness!.context.newPage();
    await page.goto(optionsUrl(harness!));
    await chooseOption(page, 'language', optionNames.en);
    // Without a website there is no tracker form, only what to do first.
    await expect
      .poll(() => page.getByTestId('destination-website-required').isVisible())
      .toBe(true);
    expect(await page.getByTestId('add-destination').count()).toBe(0);
    await page.getByTestId('website-origin').fill('https://time.example.com/reports');
    await page.getByTestId('add-website').press('Enter');
    await expect
      .poll(() => page.getByTestId('website-origin').getAttribute('aria-invalid'))
      .toBe('true');
    await expect
      .poll(() => page.getByTestId('website-origin-error').textContent())
      .toMatch(/without a path/);
    await page.getByTestId('website-origin').fill('http://localhost:3000');
    await page.getByTestId('add-website').press('Enter');
    await expect
      .poll(() => toasts(page).textContent())
      .toMatch(/Website approved\..*localhost:3000/);

    await page.reload();
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3000').isVisible())
      .toBe(true);

    await chooseOption(page, 'language', optionNames.pl);
    await expect
      .poll(() => page.getByTestId('new-website').textContent())
      .toMatch(/Zatwierdź witrynę/);
    await expect
      .poll(() => page.getByTestId('add-destination').textContent())
      .toMatch(/Zatwierdź tracker/i);
    await page.reload();
    await expect.poll(() => page.getByTestId('language').textContent()).toContain('Polski');
    const popup = await harness!.context.newPage();
    await popup.goto(popupUrl(harness!));
    // Halfway through setup the done step names the website and the current one carries the
    // way into setup; the approval lists wait until setup is complete.
    await expect
      .poll(() => popup.getByTestId('checklist-action-tracker').textContent())
      .toMatch(/Zatwierdź tracker/);
    await expect
      .poll(() => popup.getByTestId('checklist-website-link').textContent())
      .toMatch(/^\s*localhost:3000\s*$/);
    expect(await popup.getByTestId('saved-websites').count()).toBe(0);
    expect(await popup.getByTestId('saved-trackers').count()).toBe(0);
    await expect
      .poll(() => popup.getByTestId('popup-status').textContent())
      .toMatch(/Do skonfigurowania/);
    await page.getByTestId('destination-url').fill('https://tracker.example.com/team');
    await page.getByTestId('add-destination').press('Enter');
    await expect.poll(() => page.locator('[data-testid^="revoke-destination-"]').count()).toBe(1);
    await expect.poll(() => popup.getByTestId('popup-status').textContent()).toMatch(/Gotowe/);
    await expect
      .poll(async () =>
        (await popup.getByTestId('popup-website').allTextContents()).map((text) => text.trim()),
      )
      .toEqual(['localhost:3000']);
    await expect
      .poll(() => popup.getByTestId('saved-trackers').textContent())
      .toContain('Zatwierdzone trackery');
    await expect
      .poll(async () =>
        (await popup.getByTestId('popup-tracker-url').allTextContents()).map((text) => text.trim()),
      )
      .toEqual(['tracker.example.com/team']);
    await expect
      .poll(() => popup.getByTestId('popup-tracker-activity').textContent())
      .toMatch(/Brak aktywności/);
    await expect.poll(() => popup.getByTestId('open-options').isVisible()).toBe(true);
    await waitUntilIdle(page);
    const revokeLocalhost = page.getByTestId('revoke-website-http://localhost:3000');
    await page.bringToFront();
    await revokeLocalhost.press('Enter');
    await expect
      .poll(() => page.getByRole('dialog').textContent())
      .toMatch(/oraz 1\s+trackera:[\s\S]*tracker\.example\.com\/team/);
    // Escape belongs to the dialog only once its focus trap has taken focus from the trigger.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.getByRole('dialog').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid^="revoke-destination-"]').count()).toBe(1);
    await expect
      .poll(() => revokeLocalhost.evaluate((element) => element === document.activeElement))
      .toBe(true);
    await revokeLocalhost.press('Enter');
    await confirmRevoke(page);
    await expect
      .poll(() => toasts(page).textContent())
      .toMatch(/Usunięto witrynę\s*localhost:3000/);
    await expect.poll(() => page.locator('[data-testid^="revoke-destination-"]').count()).toBe(0);
    await expect
      .poll(() => page.getByTestId('destination-website-required').isVisible())
      .toBe(true);
    // Back to onboarding: the popup hides the empty lists behind the checklist.
    await expect.poll(() => popup.getByTestId('setup-checklist').isVisible()).toBe(true);
    expect(await popup.getByTestId('saved-websites').count()).toBe(0);
    expect(await popup.getByTestId('saved-trackers').count()).toBe(0);

    await page.getByTestId('website-origin').fill('http://localhost:3001');
    await page.getByTestId('add-website').press('Enter');
    await expect
      .poll(() => page.getByTestId('destination-website-single').textContent())
      .toContain('localhost:3001');
    expect(await page.getByTestId('destination-website').count()).toBe(0);
    await waitUntilIdle(page);
    await page.getByTestId('revoke-website-http://localhost:3001').click();
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3001').count())
      .toBe(0);
    await expect
      .poll(() => page.getByTestId('destination-website-required').isVisible())
      .toBe(true);
  });

  it('synchronizes setup tabs, distinguishes destination identities, and restores lost browser access', async () => {
    const page = await harness!.context.newPage();
    const other = await harness!.context.newPage();
    const url = optionsUrl(harness!);
    await page.goto(url);
    await other.goto(url);
    await chooseOption(page, 'language', optionNames.en);
    await expect
      .poll(() => other.getByTestId('add-website').textContent())
      .toMatch(/Approve website/);
    for (const [index, origin] of ['http://localhost:3100', 'http://localhost:3101'].entries()) {
      await openAddForm(page, 'website');
      await page.getByTestId('website-origin').fill(origin);
      await page.getByTestId('add-website').click();
      await expect.poll(() => other.getByTestId(`revoke-website-${origin}`).isVisible()).toBe(true);
      // The website select only appears once there is a second website to choose from.
      if (index === 0) {
        await expect
          .poll(() => page.getByTestId('destination-website-single').textContent())
          .toContain(new URL(origin).host);
      } else {
        // Trackers are listed now, so their form waits behind "Add tracker".
        await openAddForm(page, 'destination');
        await chooseOption(page, 'destination-website', origin);
      }
      await chooseOption(page, 'destination-provider', optionNames.redmine);
      await page.getByTestId('destination-url').fill('https://shared.example.com/team');
      await page.getByTestId('add-destination').click();
      const row = other.getByTestId(
        `revoke-destination-${origin}|redmine|https://shared.example.com/team`,
      );
      await expect
        .poll(() => row.getAttribute('aria-label'))
        .toBe(`Remove tracker Redmine https://shared.example.com/team (for ${origin})`);
    }
    const popup = await harness!.context.newPage();
    await popup.addInitScript(() => {
      const contains = chrome.permissions.contains.bind(chrome.permissions);
      chrome.permissions.contains = async (request) =>
        request.origins.some((origin) => origin.includes('shared.example.com'))
          ? false
          : contains(request);
    });
    await popup.goto(popupUrl(harness!));
    await expect.poll(() => popup.getByTestId('popup-status').textContent()).toMatch(/No access/);
    await expect.poll(() => popup.getByTestId('popup-missing-access').isVisible()).toBe(true);
    await expect
      .poll(async () =>
        (await popup.getByTestId('popup-tracker').allTextContents()).every((text) =>
          text.includes('No access'),
        ),
      )
      .toBe(true);
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
    await confirmRevoke(other);
    await expect
      .poll(() => page.getByTestId('revoke-website-http://localhost:3100').count())
      .toBe(0);
    await openAddForm(page, 'destination');
    await expect
      .poll(() => page.getByTestId('destination-website-single').textContent())
      .toContain('localhost:3101');
    await waitUntilIdle(other);
    await other.getByTestId('revoke-website-http://localhost:3101').click();
    await confirmRevoke(other);
    await waitUntilIdle(other);
    await expect.poll(() => page.locator('[data-testid^="revoke-destination-"]').count()).toBe(0);
  });

  it('shows saved approvals after bridge failure and retries registration explicitly', async () => {
    const page = await harness!.context.newPage();
    await page.goto(optionsUrl(harness!));
    await chooseOption(page, 'language', optionNames.en);
    // The worker also registers scripts on approval changes, so both contexts
    // must fail or the options page skips register after a successful worker run.
    await harness!.worker.evaluate(() => {
      // SAFETY: test-only stash of the native register function on the worker global.
      const g = globalThis as typeof globalThis & {
        __osiRegisterContentScripts?: typeof chrome.scripting.registerContentScripts;
      };
      g.__osiRegisterContentScripts =
        g.__osiRegisterContentScripts ??
        chrome.scripting.registerContentScripts.bind(chrome.scripting);
      chrome.scripting.registerContentScripts = async (scripts) => {
        throw new Error(`Registration failed for ${scripts.length} scripts`);
      };
    });
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
      .poll(() => page.getByTestId('setup-error').textContent())
      .toMatch(/could not be connected to the extension/);
    await harness!.worker.evaluate(() => {
      // SAFETY: restore the native register function stashed for this test.
      const g = globalThis as typeof globalThis & {
        __osiRegisterContentScripts?: typeof chrome.scripting.registerContentScripts;
      };
      if (g.__osiRegisterContentScripts) {
        chrome.scripting.registerContentScripts = g.__osiRegisterContentScripts;
      }
    });
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
