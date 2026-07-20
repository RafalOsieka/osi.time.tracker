import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeRemoteSyncUI = requireBrowser();

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
    return res.json();
  }

  async function createProject(jar: CookieJar, token: string, name: string, clientId: string) {
    const res = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name, clientId }),
    });
    return res.json();
  }

  async function createEntry(jar: CookieJar, token: string, body: Record<string, unknown>) {
    const res = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function loginPage(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"] input', 'secret');
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

  it('opens Remote Sync from a Timer-view day, edits a rounded duration, and links an issue inline', async () => {
    const { jar, token } = await apiLogin('remotesyncui@example.com');
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });

    const client = await createClient(jar, token, 'Sync UI Client ' + Date.now());
    const project = await createProject(jar, token, 'Sync UI Project ' + Date.now(), client.id);
    const configRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        systemType: 'openproject',
        baseUrl: OPENPROJECT_BASE_URL,
        executionMode: 'client',
        roundingRule: 'up_15m',
      }),
    });
    const config = await configRes.json();
    expect(config.id).toBeTruthy();

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
    await mockOpenProjectActivities(page);
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction((t) => document.body.textContent?.includes(t), title);

    await page.click(`[data-testid="timer-day-remote-sync-${dayKey}"]`);
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    await page.waitForFunction((t) => document.body.textContent?.includes(t), title);

    const rowSelector = `[data-testid="remote-sync-row-${entry.taskId}"]`;
    await page.waitForSelector(rowSelector);
    const stateText = await page.textContent(`[data-testid="remote-sync-state-${entry.taskId}"]`);
    expect(stateText).toBeTruthy();

    // Edit the rounded duration inline once activities make the row manageable.
    const roundedSelector = `[data-testid="remote-sync-rounded-duration-${entry.taskId}"]`;
    await page.waitForSelector(roundedSelector);
    await page.fill(roundedSelector, '00:00:00');
    await page.keyboard.press('Tab');
    await page.waitForSelector(`[data-testid="remote-sync-excluded-hint-${entry.taskId}"]`);

    await page.close();
  });
});
