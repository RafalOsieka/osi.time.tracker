import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

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

  async function createClient(jar: CookieJar, token: string, name: string): Promise<string> {
    const res = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name }),
    });
    return (await res.json()).id;
  }

  async function createProject(
    jar: CookieJar,
    token: string,
    name: string,
    clientId: string,
  ): Promise<string> {
    const res = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name, clientId }),
    });
    return (await res.json()).id;
  }

  async function putProxiedRemoteConfig(
    jar: CookieJar,
    token: string,
    clientId: string,
  ): Promise<string> {
    const res = await fetch(url(`/api/clients/${clientId}/remote-config`), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        systemType: 'openproject',
        baseUrl: tracker.baseUrl,
        executionMode: 'server',
        roundingRule: 'none',
      }),
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  it('4.5 completes a title search and an issue-id link flow through the proxy against a mocked tracker', async () => {
    const { jar, token } = await apiLogin('remoteissueproxyui@example.com');
    const clientId = await createClient(jar, token, `Proxied UI Client ${Date.now()}`);
    const projectId = await createProject(jar, token, `Proxied UI Project ${Date.now()}`, clientId);
    const configId = await putProxiedRemoteConfig(jar, token, clientId);
    const label = `Proxied UI Task ${Date.now()}`;
    await createTaskViaEntry(jar, token, label, projectId);

    const page = await loginAsInBrowser('remoteissueproxyui@example.com');
    // The secret is browser-only (localStorage); seed it directly as the config form would.
    await page.evaluate(({ id, secret }) => window.localStorage.setItem(`rsc:${id}`, secret), {
      id: configId,
      secret: 'proxied-e2e-secret',
    });

    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction((text) => document.body.textContent?.includes(text), label);

    const group = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: label,
      })
      .first();
    const groupTestId = await group.getAttribute('data-testid');
    const groupKey = groupTestId!.replace('timer-group-', '');

    // --- Title search through the proxy ---
    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');
    await page.fill('[data-testid="remote-issue-picker-query"]', 'Proxied');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-333"]');
    await page.click('[data-testid="remote-issue-picker-result-333"]');
    await page.waitForSelector(`[data-testid="timer-group-remote-issue-link-${groupKey}"]`);
    const linkText = await page.textContent(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
    );
    expect(linkText?.trim()).toBe('#333');

    // --- Exact issue-ID lookup through the proxy ---
    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
    await page.waitForSelector('[data-testid="remote-issue-picker-mode"]');
    await page
      .locator('[data-testid="remote-issue-picker-mode"] button', { hasText: /id/i })
      .click();
    await page.fill('[data-testid="remote-issue-picker-query"]', '777');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-777"]');
    await page.click('[data-testid="remote-issue-picker-result-777"]');
    await page.waitForFunction(
      (key) =>
        document
          .querySelector(`[data-testid="timer-group-remote-issue-link-${key}"]`)
          ?.textContent?.trim() === '#777',
      groupKey,
    );

    await page.close();
  });
});
