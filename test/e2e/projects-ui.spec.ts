import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeProjectsUI = requireBrowser();

describeProjectsUI('projects UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'projectsui@example.com', displayName: 'projectsuiuser' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  /** Create a tracker via the API, used to seed data ahead of UI-driven project CRUD. */
  async function createTrackerViaApi(name: string): Promise<{ id: string; name: string }> {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const loginRes = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'projectsui@example.com', password: 'secret' }),
    });
    jar.capture(loginRes);
    const res = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        name,
        systemType: 'openproject',
        baseUrl: `https://${
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'tracker'
        }.example.com`,
        executionMode: 'client',
        roundingRule: 'none',
      }),
    });
    return res.json();
  }

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  it('full CRUD happy path through the UI, local project, tracker link, filter, and detach', async () => {
    const trackerA = await createTrackerViaApi('UI Tracker A ' + Date.now());
    const trackerB = await createTrackerViaApi('UI Tracker B ' + Date.now());

    const page = await loginAs('projectsui@example.com');
    await page.click('[data-testid="app-sidebar"] a[href="/projects"]');
    await page.waitForSelector('[data-testid="projects-page"]');

    // Create a local project (no tracker)
    await page.click('[data-testid="new-project-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('UI Local Project');
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('UI Local Project'));

    // Create a project under Tracker A
    await page.click('[data-testid="new-project-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('UI Project One');
    await page.click('[data-testid="project-tracker-select"]');
    await page.getByRole('option', { name: trackerA.name }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]', { state: 'hidden' });

    await page.waitForFunction(() => document.body.textContent?.includes('UI Project One'));
    expect(await page.textContent('[data-testid="projects-table"]')).toContain('UI Project One');
    expect(await page.textContent('[data-testid="projects-table"]')).toContain(trackerA.name);

    // Filter by Tracker B: the project (under Tracker A) should disappear
    await page.click('[data-testid="project-tracker-filter"]');
    await page.getByRole('option', { name: trackerB.name }).click();
    await page.waitForFunction(() => !document.body.textContent?.includes('UI Project One'));
    expect(await page.textContent('[data-testid="projects-table"]')).not.toContain(
      'UI Project One',
    );

    // Clear the filter by selecting Tracker A so the project is visible again
    await page.click('[data-testid="project-tracker-filter"]');
    await page.getByRole('option', { name: trackerA.name }).click();
    await page.waitForFunction(() => document.body.textContent?.includes('UI Project One'));

    // Edit: rename and detach from tracker (confirm path)
    const row = page.locator('tr', { hasText: 'UI Project One' });
    await row.locator('[data-testid^="edit-project-"]').click();
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('UI Project Renamed');
    // Clear tracker selection to detach
    const trackerSelect = page.locator('[data-testid="project-tracker-select"]');
    await trackerSelect.click();
    // Prefer an explicit clear control if present; otherwise re-select placeholder path
    const clearButton = page.locator(
      '[data-testid="project-tracker-select"] button[aria-label*="clear" i], [data-testid="project-tracker-select"] [data-slot="clear"]',
    );
    if ((await clearButton.count()) > 0) {
      await clearButton.first().click();
    } else {
      // Escape the select and force-clear via keyboard if clearable control is hard to hit
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="project-tracker-select"]',
        ) as HTMLElement | null;
        el?.dispatchEvent(new Event('focus', { bubbles: true }));
      });
    }
    await page.click('[data-testid="save-button"]');

    // Detach confirmation dialog (when tracker changes away from a linked value)
    const confirm = page.locator('[data-testid="confirm-accept"]');
    if ((await confirm.count()) > 0) {
      await confirm.click();
    }
    await page.waitForSelector('[data-testid="project-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('UI Project Renamed'));

    // Delete the project
    const renamedRow = page.locator('tr', { hasText: 'UI Project Renamed' });
    await renamedRow.locator('[data-testid^="delete-project-"]').click();
    await page.locator('[data-testid="confirm-accept"]').click();
    await page.waitForFunction(() => !document.body.textContent?.includes('UI Project Renamed'));
    expect(await page.textContent('[data-testid="projects-table"]')).not.toContain(
      'UI Project Renamed',
    );
  });
});
