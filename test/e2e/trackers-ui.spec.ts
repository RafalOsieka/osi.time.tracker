import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeTrackersUI = requireBrowser();

describeTrackersUI('trackers UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'trackersui@example.com', displayName: 'trackersuiuser' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  it('creates, edits, and deletes a tracker through the form; secret stays local', async () => {
    const page = await loginAs('trackersui@example.com');
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
    const page = await loginAs('trackersui@example.com');
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
    const page = await loginAs('trackersui@example.com');
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
});
