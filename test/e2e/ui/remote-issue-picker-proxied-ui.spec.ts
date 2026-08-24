import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import type { Locator, Page } from 'playwright-core';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUsers } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin, type CookieJar } from '../helpers/auth';
import { groupKeyForTitleScript, pageIncludesTextScript } from '../helpers/dom';

const pageIncludesText = pageIncludesTextScript();
const groupKeyForTitle = groupKeyForTitleScript();

const describeRemoteIssuePickerProxiedUI = requireBrowser();

/** Minimal fake OpenProject server reached by the OSI server (not the browser). */
function startFakeTracker(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url?.includes('/api/v3/work_packages/')) {
        const id = req.url.split('/').pop();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id, subject: 'Proxied Exact Issue' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({ _embedded: { elements: [{ id: '333', subject: 'Proxied Match' }] } }),
      );
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describeRemoteIssuePickerProxiedUI('proxied remote issue picker UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'remoteissueproxyui@example.com', displayName: 'remoteissueproxyuiuser' },
  ]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  let tracker: { server: Server; baseUrl: string };
  beforeAll(async () => {
    tracker = await startFakeTracker();
  });
  afterAll(() => {
    tracker.server.close();
  });

  async function createTracker(
    jar: CookieJar,
    token: string,
    name: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; name: string }> {
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
        ...overrides,
      }),
    });
    return res.json();
  }

  async function createProject(
    jar: CookieJar,
    token: string,
    name: string,
    trackerId: string,
  ): Promise<string> {
    const res = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name, trackerId }),
    });
    return (await res.json()).id;
  }

  async function createTaskViaEntry(
    jar: CookieJar,
    token: string,
    title: string,
    projectId: string,
  ): Promise<string> {
    const startRes = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ title, projectId }),
    });
    const entry = await startRes.json();
    await fetch(url(`/api/time-entries/${entry.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });
    return entry.taskId;
  }

  async function loginAsInBrowser(email: string): Promise<Page> {
    const page = await createPage('/');
    await fillLogin(page, email, 'secret', { height: 900 });
    return page;
  }

  it('4.5 completes a title search and an issue-id link flow through the proxy against a mocked tracker', async () => {
    const { jar, token } = await apiLogin('remoteissueproxyui@example.com');
    const trackerRow = await createTracker(jar, token, `Proxied UI Tracker ${Date.now()}`, {
      baseUrl: tracker.baseUrl,
      systemType: 'openproject',
      executionMode: 'server',
    });
    const projectId = await createProject(
      jar,
      token,
      `Proxied UI Project ${Date.now()}`,
      trackerRow.id,
    );
    const configId = trackerRow.id;
    const label = `Proxied UI Task ${Date.now()}`;
    await createTaskViaEntry(jar, token, label, projectId);

    const page = await loginAsInBrowser('remoteissueproxyui@example.com');
    // The secret is browser-only (localStorage); seed it directly as the config form would.
    await page.evaluate(({ id, secret }) => window.localStorage.setItem(`rsc:${id}`, secret), {
      id: configId,
      secret: 'proxied-e2e-secret',
    });

    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, label);

    const groupKey = await page.evaluate(groupKeyForTitle, label);
    if (!groupKey) throw new Error('group not found for label');
    const group = page.locator(`[data-testid="timer-group-${groupKey}"]`);

    async function openRemoteIssuePicker(target: Locator) {
      const link = target.locator('[data-testid^="timer-group-remote-issue-link-"]');
      if ((await link.count()) > 0) {
        await link.first().hover();
        await target.locator('[data-testid="remote-issue-picker-edit-menu"]').waitFor({
          state: 'visible',
        });
        await target.locator('[data-testid="remote-issue-picker-trigger"]').click();
        return;
      }
      await target
        .locator(
          '[data-testid="remote-issue-picker-trigger"], [data-testid^="timer-group-remote-issue-unlinked-"]',
        )
        .first()
        .click();
    }

    // --- Title search through the proxy ---
    await openRemoteIssuePicker(group);
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');
    await page
      .locator('[data-testid="remote-issue-picker-mode"]')
      .getByRole('radio', { name: /title/i })
      .click();
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('Proxied');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-333"]');
    await page.click('[data-testid="remote-issue-picker-result-333"]');
    // Day-scoped reassignment changes the task/group id; wait by issue label then re-resolve.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid^="timer-group-remote-issue-link-"]')
          ?.textContent?.trim() === '#333',
    );
    const linkedKey = await page.evaluate(groupKeyForTitle, label);
    if (!linkedKey) throw new Error('linked group not found');
    const linkedGroup = page.locator(`[data-testid="timer-group-${linkedKey}"]`);
    const linkText = await page.textContent(
      `[data-testid="timer-group-remote-issue-link-${linkedKey}"]`,
    );
    expect(linkText?.trim()).toBe('#333');

    // --- Exact issue-ID lookup through the proxy ---
    await openRemoteIssuePicker(linkedGroup);
    await page.waitForSelector('[data-testid="remote-issue-picker-mode"]');
    await page
      .locator('[data-testid="remote-issue-picker-mode"]')
      .getByRole('radio', { name: /id/i })
      .click();
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('777');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-777"]');
    await page.click('[data-testid="remote-issue-picker-result-777"]');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid^="timer-group-remote-issue-link-"]')
          ?.textContent?.trim() === '#777',
    );

    await page.close();
  });
});
