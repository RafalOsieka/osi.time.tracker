import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';
import { pageIncludesTextScript } from './support/dom';

const describeRemoteSyncUI = requireBrowser();
const pageIncludesText = pageIncludesTextScript();

const OPENPROJECT_BASE_URL = 'https://op.remote-sync-ui.example.com';

describeRemoteSyncUI('remote sync page UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'remotesyncui@example.com', displayName: 'Remote Sync UI' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function apiLogin(email: string) {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const res = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email, password: 'secret' }),
    });
    jar.capture(res);
    return { jar, token };
  }

  async function createClient(jar: CookieJar, token: string, name: string) {
    const res = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name }),
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  async function createProject(jar: CookieJar, token: string, name: string, clientId: string) {
    const res = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name, clientId }),
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  async function createEntry(jar: CookieJar, token: string, body: Record<string, unknown>) {
    const res = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  async function putRemoteConfig(
    jar: CookieJar,
    token: string,
    clientId: string,
    roundingRule: string,
  ) {
    const res = await fetch(url(`/api/clients/${clientId}/remote-config`), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        systemType: 'openproject',
        baseUrl: OPENPROJECT_BASE_URL,
        executionMode: 'client',
        roundingRule,
        // Pre-select the mocked OpenProject activity so the row is pushable.
        requiredFieldDefaults: { activity: '1' },
      }),
    });
    expect(res.status).toBe(200);
    return res.json() as Promise<{ id: string }>;
  }

  async function loginPage(email: string) {
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

  /** Serves the OpenProject time-entry form so activities load and the row becomes manageable. */
  async function mockOpenProjectActivities(page: Page): Promise<void> {
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/time_entries/form**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _embedded: {
            schema: {
              activity: {
                _embedded: {
                  allowedValues: [{ id: 1, name: 'Development' }],
                },
              },
            },
          },
        }),
      });
    });
  }

  async function seedBrowserSecret(page: Page, configId: string) {
    await page.evaluate(({ id, secret }) => window.localStorage.setItem(`rsc:${id}`, secret), {
      id: configId,
      secret: 'e2e-remote-sync-secret',
    });
  }

  async function openSyncDay(page: Page, dayKey: string, taskName: string) {
    await page.goto(url(`/sync/${dayKey}`));
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    await page.waitForFunction(pageIncludesText, taskName);
  }

  it('opens Remote Sync from a Timer-view day, edits a rounded duration, and links an issue inline', async () => {
    const { jar, token } = await apiLogin('remotesyncui@example.com');
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });

    const client = await createClient(jar, token, 'Sync UI Client ' + Date.now());
    const project = await createProject(jar, token, 'Sync UI Project ' + Date.now(), client.id);
    const config = await putRemoteConfig(jar, token, client.id, 'up_15m');

    const now = new Date();
    const startedAt = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
    const stoppedAt = now.toISOString();
    const title = 'Sync UI Task ' + Date.now();
    const entry = await createEntry(jar, token, {
      title,
      projectId: project.id,
      startedAt,
      stoppedAt,
    });
    expect(entry.taskId).toBeDefined();
    await fetch(url(`/api/tasks/${entry.taskId}/remote-issue-ref`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ remoteIssueId: '123', cachedTitle: 'Linked Issue' }),
    });

    const dayKey = startedAt.slice(0, 10);

    const page = await loginPage('remotesyncui@example.com');
    await seedBrowserSecret(page, config.id);
    await mockOpenProjectActivities(page);
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, title);

    await page.click(`[data-testid="timer-day-remote-sync-${dayKey}"]`);
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    await page.waitForFunction(pageIncludesText, title);

    const rowSelector = `[data-testid="remote-sync-row-${entry.taskId}"]`;
    await page.waitForSelector(rowSelector);
    const stateText = await page.textContent(`[data-testid="remote-sync-state-${entry.taskId}"]`);
    expect(stateText).toBeTruthy();

    // Expand the row so detail controls (rounded duration, entries) are available.
    await page.click(`[data-testid="remote-sync-expand-${entry.taskId}"]`);

    // Edit the rounded duration inline once activities make the row manageable.
    const roundedSelector = `[data-testid="remote-sync-rounded-duration-${entry.taskId}"]`;
    await page.waitForSelector(roundedSelector);
    await page.locator(`${roundedSelector} input, ${roundedSelector}`).first().fill('00:00:00');
    await page.keyboard.press('Tab');
    await page.waitForSelector(`[data-testid="remote-sync-excluded-hint-${entry.taskId}"]`);

    // Reset duration so the row is pushable again for the review dialog.
    await page.locator(`${roundedSelector} input, ${roundedSelector}`).first().fill('00:30:00');
    await page.keyboard.press('Tab');

    // Wait until the row is pushable (activity default applied + non-zero duration).
    await page.waitForFunction(() => {
      const btn = document.querySelector(
        '[data-testid="remote-sync-export-button"]',
      ) as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    });

    // Open review dialog, cancel without sending.
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/time_entries**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 9001 }),
        });
        return;
      }
      await route.continue();
    });
    await page.click('[data-testid="remote-sync-export-button"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog-body"]');
    await page.waitForSelector(`[data-testid="remote-sync-export-row-${entry.taskId}"]`);
    await page.click('[data-testid="remote-sync-export-cancel"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog-body"]', {
      state: 'hidden',
    });

    // Edit comment, confirm export, reach report.
    await page
      .locator(
        `[data-testid="remote-sync-comment-${entry.taskId}"] input, [data-testid="remote-sync-comment-${entry.taskId}"]`,
      )
      .first()
      .fill('Reviewed comment from E2E');
    await page.click('[data-testid="remote-sync-export-button"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog-body"]');
    await page.waitForFunction((taskId) => {
      const el = document.querySelector(`[data-testid="remote-sync-export-comment-${taskId}"]`);
      return !!el && el.textContent?.includes('Reviewed comment from E2E');
    }, entry.taskId);
    await page.click('[data-testid="remote-sync-export-confirm"]');
    await page.waitForSelector('[data-testid="remote-sync-export-group-succeeded"]');
    await page.waitForSelector(`[data-testid="remote-sync-export-result-${entry.taskId}"]`);
    await page.click('[data-testid="remote-sync-export-close"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog"]', { state: 'hidden' });

    await page.close();
  });

  it('applies a rounding suggestion, keeps it across entry changes, and resets to the rule default', async () => {
    const { jar, token } = await apiLogin('remotesyncui@example.com');
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });

    const client = await createClient(jar, token, 'Suggestion Client ' + Date.now());
    const project = await createProject(jar, token, 'Suggestion Project ' + Date.now(), client.id);
    const config = await putRemoteConfig(jar, token, client.id, 'nearest_15m');

    // 1h 03m total across two entries so floor/ceil suggestions differ from exact.
    // Anchor a few hours in the past so the pair is always valid against clock skew.
    const dayStart = new Date(Date.now() - 5 * 60 * 60 * 1000);
    dayStart.setUTCMinutes(0, 0, 0);
    const title = 'Suggestion Task ' + Date.now();
    const entryA = await createEntry(jar, token, {
      title,
      projectId: project.id,
      startedAt: new Date(dayStart.getTime()).toISOString(),
      stoppedAt: new Date(dayStart.getTime() + 40 * 60 * 1000).toISOString(),
    });
    const entryB = await createEntry(jar, token, {
      title,
      projectId: project.id,
      startedAt: new Date(dayStart.getTime() + 40 * 60 * 1000).toISOString(),
      stoppedAt: new Date(dayStart.getTime() + 63 * 60 * 1000).toISOString(),
    });
    expect(entryA.taskId).toBe(entryB.taskId);
    await fetch(url(`/api/tasks/${entryA.taskId}/remote-issue-ref`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ remoteIssueId: '456', cachedTitle: 'Suggestion Issue' }),
    });

    const dayKey = dayStart.toISOString().slice(0, 10);
    const dayApi = await fetch(url(`/api/sync/day?date=${dayKey}`), {
      headers: { cookie: jar.header() },
    });
    expect(dayApi.status).toBe(200);
    const dayBody = await dayApi.json();
    expect(dayBody.rows.some((row: { taskId: string }) => row.taskId === entryA.taskId)).toBe(true);

    const page = await loginPage('remotesyncui@example.com');
    await seedBrowserSecret(page, config.id);
    await mockOpenProjectActivities(page);
    await openSyncDay(page, dayKey, title);
    await page.waitForSelector(`[data-testid="remote-sync-row-${entryA.taskId}"]`);

    // Activities must resolve before the expanded detail exposes duration controls.
    const activitySelect = `[data-testid="remote-sync-activity-select-${entryA.taskId}"]`;
    const activityError = `[data-testid="remote-sync-activity-error-${entryA.taskId}"]`;
    await page.waitForFunction(
      ({ select, error }) => !!(document.querySelector(select) || document.querySelector(error)),
      { select: activitySelect, error: activityError },
    );
    if ((await page.locator(activityError).count()) > 0) {
      await page.click(`[data-testid="remote-sync-activity-retry-${entryA.taskId}"]`);
      await page.waitForSelector(activitySelect);
    }

    await page.click(`[data-testid="remote-sync-expand-${entryA.taskId}"]`);

    const roundedSelector = `[data-testid="remote-sync-rounded-duration-${entryA.taskId}"]`;
    await page.waitForSelector(roundedSelector);
    // nearest_15m on 1h03m → 1h00m default
    await expect
      .poll(async () => page.inputValue(`${roundedSelector} input, ${roundedSelector}`))
      .toBe('01:00:00');

    await page.click(`[data-testid="remote-sync-rounding-suggestion-${entryA.taskId}-ceil"]`);
    await expect
      .poll(async () => page.inputValue(`${roundedSelector} input, ${roundedSelector}`))
      .toBe('01:15:00');
    await page.waitForSelector(`[data-testid="remote-sync-reset-duration-${entryA.taskId}"]`);

    // Deselect one entry; override must survive (REQ-113 / REQ-222).
    await page
      .locator(
        `[data-testid="remote-sync-entry-check-${entryB.id}"] input, [data-testid="remote-sync-entry-check-${entryB.id}"]`,
      )
      .first()
      .click();
    await expect
      .poll(async () => page.inputValue(`${roundedSelector} input, ${roundedSelector}`))
      .toBe('01:15:00');

    await page.click(`[data-testid="remote-sync-reset-duration-${entryA.taskId}"]`);
    // Remaining selection is 40m → nearest_15m → 45m
    await expect
      .poll(async () => page.inputValue(`${roundedSelector} input, ${roundedSelector}`))
      .toBe('00:45:00');

    await page.close();
  });

  it('navigates between days and keeps bulk selection summaries in sync', async () => {
    const { jar, token } = await apiLogin('remotesyncui@example.com');
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });

    const client = await createClient(jar, token, 'Sync Nav Client ' + Date.now());
    const project = await createProject(jar, token, 'Sync Nav Project ' + Date.now(), client.id);
    const config = await putRemoteConfig(jar, token, client.id, 'none');

    // Use a day a few days in the past (still valid vs clock skew) so navigation
    // to the next empty day is deterministic.
    const dayDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const day = dayDate.toISOString().slice(0, 10);
    const next = new Date(dayDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startedAt = `${day}T09:00:00.000Z`;
    const stoppedAt = `${day}T10:00:00.000Z`;
    const title = 'Sync Nav Task ' + Date.now();
    const entry = await createEntry(jar, token, {
      title,
      projectId: project.id,
      startedAt,
      stoppedAt,
    });
    expect(entry.taskId).toBeDefined();
    await fetch(url(`/api/tasks/${entry.taskId}/remote-issue-ref`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ remoteIssueId: '321', cachedTitle: 'Nav Issue' }),
    });

    const dayApi = await fetch(url(`/api/sync/day?date=${day}`), {
      headers: { cookie: jar.header() },
    });
    expect(dayApi.status).toBe(200);
    expect((await dayApi.json()).rows.length).toBeGreaterThan(0);

    const page = await loginPage('remotesyncui@example.com');
    await seedBrowserSecret(page, config.id);
    await mockOpenProjectActivities(page);
    await openSyncDay(page, day, title);
    await page.waitForSelector(`[data-testid="remote-sync-row-${entry.taskId}"]`);

    // Wait until activities make the row pushable so tracked includes the hour.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="remote-sync-total-tracked"]');
      return !!el && el.textContent?.includes('01:00:00');
    });

    await page.click('[data-testid="remote-sync-exclude-all"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="remote-sync-total-tracked"]');
      return !!el && el.textContent?.includes('00:00:00');
    });
    await page.click('[data-testid="remote-sync-include-all"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="remote-sync-total-tracked"]');
      return !!el && el.textContent?.includes('01:00:00');
    });

    await page.click('[data-testid="remote-sync-next-day"]');
    await page.waitForURL(`**/sync/${next}`);
    await page.waitForSelector('[data-testid="remote-sync-empty-state"]');

    await page.click('[data-testid="remote-sync-prev-day"]');
    await page.waitForURL(`**/sync/${day}`);
    await page.waitForSelector(`[data-testid="remote-sync-row-${entry.taskId}"]`);
    // Review state must not carry over from the empty day (defaults restore).
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="remote-sync-total-tracked"]');
      return !!el && el.textContent?.includes('01:00:00');
    });

    await page.click('[data-testid="remote-sync-pick-date"]');
    await page.waitForSelector('[data-testid="remote-sync-calendar"]');
    // Drive the native date input directly so Nuxt UI's wrapper cannot swallow events.
    await page.locator('[data-testid="remote-sync-calendar"] input[type="date"]').evaluate((el, value) => {
      const input = el as HTMLInputElement;
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }, next);
    await page.waitForURL(`**/sync/${next}`);
    await page.waitForSelector('[data-testid="remote-sync-empty-state"]');

    await page.close();
  });
});
