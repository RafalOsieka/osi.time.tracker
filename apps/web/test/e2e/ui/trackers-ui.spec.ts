import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { pageIncludesTextScript } from '../helpers/dom';

const describeTrackersUI = requireBrowser();
const pageIncludesText = pageIncludesTextScript();

describeTrackersUI('trackers UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function openAuthed() {
    const user = await seedUser(dbUrl, { displayName: 'trackersuiuser' });
    const page = await createPage('/');
    await loginAs(page, user.email, user.password, { height: 900 });
    return page;
  }

  it('creates, edits, and deletes a tracker through the form; secret stays local', async () => {
    const page = await openAuthed();
    await page.click('[data-testid="app-sidebar"] a[href="/trackers"]');
    await page.waitForSelector('[data-testid="trackers-page"]');

    // Empty state is reachable before the first create
    await page.waitForSelector(
      '[data-testid="trackers-empty-state"], [data-testid="trackers-table"]',
    );

    const trackerName = 'UI Tracker ' + Date.now();
    const sentBodies: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/trackers') && ['POST', 'PATCH'].includes(request.method())) {
        const data = request.postData();
        if (data) sentBodies.push(data);
      }
    });

    await page.click('[data-testid="new-tracker-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    await page
      .locator('[data-testid="tracker-name-input"] input, [data-testid="tracker-name-input"]')
      .first()
      .fill(trackerName);
    await page
      .locator(
        '[data-testid="tracker-base-url-input"] input, [data-testid="tracker-base-url-input"]',
      )
      .first()
      .fill('https://redmine.example.com');
    await page
      .locator('[data-testid="tracker-secret-input"] input, [data-testid="tracker-secret-input"]')
      .first()
      .fill('super-secret-api-key');
    await page.click('[data-testid="tracker-system-type-select"]');
    await page.getByRole('option', { name: 'Redmine' }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]', { state: 'hidden' });
    await page.waitForFunction((name) => document.body.textContent?.includes(name), trackerName);

    expect(sentBodies.length).toBeGreaterThan(0);
    for (const body of sentBodies) {
      expect(body).not.toContain('super-secret-api-key');
    }

    const row = page.locator('tr', { hasText: trackerName });
    await row.locator('[data-testid^="edit-tracker-"]').click();
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    const savedSystemType = await page
      .locator('[data-testid="tracker-system-type-select"]')
      .textContent();
    expect(savedSystemType).toContain('Redmine');
    expect(await page.inputValue('[data-testid="tracker-base-url-input"]')).toBe(
      'https://redmine.example.com',
    );
    expect(await page.inputValue('[data-testid="tracker-secret-input"]')).toBe(
      'super-secret-api-key',
    );

    const renamed = trackerName + ' Renamed';
    await page
      .locator('[data-testid="tracker-name-input"] input, [data-testid="tracker-name-input"]')
      .first()
      .fill(renamed);
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]', { state: 'hidden' });
    await page.waitForFunction((name) => document.body.textContent?.includes(name), renamed);

    const renamedRow = page.locator('tr', { hasText: renamed });
    await renamedRow.locator('[data-testid^="delete-tracker-"]').click();
    await page.locator('[data-testid="confirm-accept"]').click();
    await page.waitForFunction((name) => !document.body.textContent?.includes(name), renamed);
    expect(await page.textContent('[data-testid="trackers-table"]')).not.toContain(renamed);

    await page.close();
  });

  it('shows a translated validation error for an invalid base URL', async () => {
    const page = await openAuthed();
    await page.click('[data-testid="app-sidebar"] a[href="/trackers"]');
    await page.waitForSelector('[data-testid="trackers-page"]');

    await page.click('[data-testid="new-tracker-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    await page
      .locator('[data-testid="tracker-name-input"] input, [data-testid="tracker-name-input"]')
      .first()
      .fill('Invalid URL Tracker ' + Date.now());
    await page
      .locator(
        '[data-testid="tracker-base-url-input"] input, [data-testid="tracker-base-url-input"]',
      )
      .first()
      .fill('not-a-url');
    await page.click('[data-testid="save-button"]');

    await page.waitForFunction(() =>
      /Base URL must be a valid URL|Adres URL bazowy musi być prawidłowym adresem URL/.test(
        document.body.textContent ?? '',
      ),
    );
    expect(await page.locator('[data-testid="tracker-dialog"]').count()).toBeGreaterThan(0);

    await page.close();
  });

  it('saves nearest_15m rounding and reloads the persisted selection', async () => {
    const page = await openAuthed();
    await page.click('[data-testid="app-sidebar"] a[href="/trackers"]');
    await page.waitForSelector('[data-testid="trackers-page"]');

    const trackerName = 'Nearest Rounding Tracker ' + Date.now();
    await page.click('[data-testid="new-tracker-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    await page
      .locator('[data-testid="tracker-name-input"] input, [data-testid="tracker-name-input"]')
      .first()
      .fill(trackerName);
    await page
      .locator(
        '[data-testid="tracker-base-url-input"] input, [data-testid="tracker-base-url-input"]',
      )
      .first()
      .fill('https://op.nearest.example.com');
    await page.click('[data-testid="tracker-rounding-rule-select"]');
    await page.getByRole('option', { name: /Nearest 15 minutes|Najbliższe 15 minut/i }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]', { state: 'hidden' });
    await page.waitForFunction((name) => document.body.textContent?.includes(name), trackerName);

    const row = page.locator('tr', { hasText: trackerName });
    await row.locator('[data-testid^="edit-tracker-"]').click();
    await page.waitForSelector('[data-testid="tracker-dialog"]');

    const savedRule = await page
      .locator('[data-testid="tracker-rounding-rule-select"]')
      .textContent();
    expect(savedRule).toMatch(/Nearest 15 minutes|Najbliższe 15 minut/i);

    await page.close();
  });

  it('defaults the direct-browser checkbox on and exposes help without a pointer', async () => {
    const user = await seedUser(dbUrl, { displayName: 'trackersmobileuser' });
    const page = await createPage('/');
    await loginAs(page, user.email, user.password, { width: 390, height: 844 });
    await page.goto(new URL('/trackers', page.url()).href);
    await page.waitForSelector('[data-testid="trackers-page"]');

    const trackerName = 'Mobile Direct Tracker ' + Date.now();
    await page.click('[data-testid="new-tracker-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    const checkbox = page
      .locator('[data-testid="tracker-direct-browser-access"] [role="checkbox"]')
      .first();
    await checkbox.waitFor();
    expect(await checkbox.getAttribute('aria-checked')).toBe('true');
    expect(await page.locator('[data-testid="tracker-extension-status"]').count()).toBe(0);

    await page.locator('[data-testid="tracker-direct-browser-access-help"]').focus();
    await page.waitForFunction(() => /CORS|cors/.test(document.body.textContent ?? ''));

    await page
      .locator('[data-testid="tracker-name-input"] input, [data-testid="tracker-name-input"]')
      .first()
      .fill(trackerName);
    await page
      .locator(
        '[data-testid="tracker-base-url-input"] input, [data-testid="tracker-base-url-input"]',
      )
      .first()
      .fill('https://mobile-client.example.com');
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]', { state: 'hidden' });
    await page.waitForFunction((name) => document.body.textContent?.includes(name), trackerName);

    const row = page.locator('tr, [data-testid="trackers-row"]', { hasText: trackerName });
    await row.locator('[data-testid^="edit-tracker-"]').click();
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    expect(
      await page
        .locator('[data-testid="tracker-direct-browser-access"] [role="checkbox"]')
        .first()
        .getAttribute('aria-checked'),
    ).toBe('true');

    await page.close();
  });

  it('saves extension-required access without installation and keeps local timer entry working', async () => {
    const page = await openAuthed();
    await page.click('[data-testid="app-sidebar"] a[href="/trackers"]');
    await page.waitForSelector('[data-testid="trackers-page"]');

    const trackerName = 'Extension UI Tracker ' + Date.now();
    await page.click('[data-testid="new-tracker-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    await page
      .locator('[data-testid="tracker-name-input"] input, [data-testid="tracker-name-input"]')
      .first()
      .fill(trackerName);
    await page
      .locator(
        '[data-testid="tracker-base-url-input"] input, [data-testid="tracker-base-url-input"]',
      )
      .first()
      .fill('https://extension.example.com');
    await page.locator('[data-testid="tracker-direct-browser-access"] [role="checkbox"]').click();
    expect(
      await page
        .locator('[data-testid="tracker-direct-browser-access"] [role="checkbox"]')
        .first()
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(await page.locator('[data-testid="tracker-extension-status"]').count()).toBe(0);
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="tracker-dialog"]', { state: 'hidden' });
    await page.waitForFunction((name) => document.body.textContent?.includes(name), trackerName);

    await page.reload();
    await page.waitForSelector('[data-testid="trackers-page"]');
    const row = page.locator('tr', { hasText: trackerName });
    await row.locator('[data-testid^="edit-tracker-"]').click();
    await page.waitForSelector('[data-testid="tracker-dialog"]');
    expect(
      await page
        .locator('[data-testid="tracker-direct-browser-access"] [role="checkbox"]')
        .first()
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(await page.locator('[data-testid="tracker-extension-status"]').count()).toBe(0);
    await page.click('[data-testid="cancel-button"]');

    await page.click('[data-testid="app-sidebar"] a[href="/"]');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    const titleInput = page
      .locator('[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]')
      .first();
    await titleInput.click();
    await titleInput.fill('Local entry with extension tracker');
    await titleInput.press('Escape');
    await page.click('[data-testid="timer-toggle-button"]');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
    );
    await page.keyboard.press('Escape');
    const stopResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/time-entries/') &&
        response.ok(),
    );
    await page.locator('[data-testid="timer-toggle-button"]').evaluate((el: HTMLElement) => {
      el.click();
    });
    await stopResponse;
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') !== 'true',
    );
    await page.waitForFunction(pageIncludesText, 'Local entry with extension tracker');

    await page.close();
  });
});
