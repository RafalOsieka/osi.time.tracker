import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeRemoteIssuePickerUI = requireBrowser();

const OPENPROJECT_BASE_URL = 'https://op.remote-issue-picker-ui.example.com';

describeRemoteIssuePickerUI('remote issue picker UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'remoteissuepickerui@example.com', displayName: 'remoteissuepickeruiuser' },
  ]);
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

  async function putRemoteConfig(jar: CookieJar, token: string, clientId: string): Promise<void> {
    await fetch(url(`/api/clients/${clientId}/remote-config`), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        systemType: 'openproject',
        baseUrl: OPENPROJECT_BASE_URL,
        executionMode: 'client',
        roundingRule: 'none',
        apiKey: 'e2e-secret-api-key',
      }),
    });
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
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  /** Registers a route mock that serves the OpenProject work-packages API. */
  async function mockOpenProject(
    page: Page,
    handlers: {
      onSearch?: (searchParams: URLSearchParams) => { status: number; body: unknown };
      onById?: (id: string) => { status: number; body: unknown };
    },
  ): Promise<void> {
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`, async (route) => {
      const reqUrl = new URL(route.request().url());
      const pathAfterBase = reqUrl.pathname.replace('/api/v3/work_packages', '');
      if (pathAfterBase.startsWith('/') && pathAfterBase.length > 1) {
        const id = pathAfterBase.slice(1);
        const result = handlers.onById?.(id) ?? { status: 404, body: {} };
        await route.fulfill({
          status: result.status,
          contentType: 'application/json',
          body: JSON.stringify(result.body),
        });
        return;
      }
      const result = handlers.onSearch?.(reqUrl.searchParams) ?? {
        status: 200,
        body: { _embedded: { elements: [] } },
      };
      await route.fulfill({
        status: result.status,
        contentType: 'application/json',
        body: JSON.stringify(result.body),
      });
    });
  }

  function workPackagesPayload(items: { id: string; subject: string }[]) {
    return { _embedded: { elements: items } };
  }

  async function setupClientAndTask(label: string) {
    const { jar, token } = await apiLogin('remoteissuepickerui@example.com');
    const clientId = await createClient(jar, token, `${label} Client ${Date.now()}`);
    const projectId = await createProject(jar, token, `${label} Project ${Date.now()}`, clientId);
    await putRemoteConfig(jar, token, clientId);
    const taskId = await createTaskViaEntry(jar, token, `${label} Task ${Date.now()}`, projectId);
    return { jar, token, taskId };
  }

  it('6.1 searches by title, links, replaces, and unlinks a remote issue reference', async () => {
    await setupClientAndTask('Title');
    const page = await loginAsInBrowser('remoteissuepickerui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    await mockOpenProject(page, {
      onSearch: (params) => {
        expect(params.get('filters')).toContain('~');
        return {
          status: 200,
          body: workPackagesPayload([{ id: '111', subject: 'First Match' }]),
        };
      },
    });

    // Locate the newly created task's row via its title.
    await page.reload();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() => document.body.textContent?.includes('Title Task'));

    const group = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: 'Title Task',
      })
      .first();
    const groupTestId = await group.getAttribute('data-testid');
    const groupKey = groupTestId!.replace('timer-group-', '');

    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');

    // Explicit submission: typing alone must not trigger a search.
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('Fir');
    await page.waitForTimeout(200);
    expect(await page.locator('[data-testid="remote-issue-picker-results"]').count()).toBe(0);

    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-111"]');
    await page.click('[data-testid="remote-issue-picker-result-111"]');

    await page.waitForSelector(`[data-testid="timer-group-remote-issue-link-${groupKey}"]`);
    const linkText = await page.textContent(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
    );
    expect(linkText?.trim()).toBe('#111');
    const href = await page.getAttribute(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
      'href',
    );
    expect(href).toBe(`${OPENPROJECT_BASE_URL}/work_packages/111`);
    const title = await page.getAttribute(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
      'title',
    );
    expect(title).toContain('First Match');

    // --- Replace the link with a new selection ---
    await mockOpenProject(page, {
      onSearch: () => ({
        status: 200,
        body: workPackagesPayload([{ id: '222', subject: 'Second Match' }]),
      }),
    });
    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('Sec');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-222"]');
    await page.click('[data-testid="remote-issue-picker-result-222"]');

    await page.waitForFunction(
      (key) =>
        document
          .querySelector(`[data-testid="timer-group-remote-issue-link-${key}"]`)
          ?.textContent?.trim() === '#222',
      groupKey,
    );

    // --- Unlink ---
    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
    await page.waitForSelector('[data-testid="remote-issue-picker-unlink"]');
    await page.click('[data-testid="remote-issue-picker-unlink"]');
    await page.waitForSelector(`[data-testid="timer-group-remote-issue-unlinked-${groupKey}"]`);

    await page.close();
  });

  it('6.1/6.2 searches by exact id, and 6.2 covers validation, not-found, network failure, and bounded results', async () => {
    const { taskId } = await setupClientAndTask('IdSearch');
    const page = await loginAsInBrowser('remoteissuepickerui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() => document.body.textContent?.includes('IdSearch Task'));

    const group = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: 'IdSearch Task',
      })
      .first();

    // --- Exact-ID search success ---
    await mockOpenProject(page, {
      onById: (id) => ({ status: 200, body: { id, subject: 'Exact Issue' } }),
    });
    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
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
      .fill('999');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-999"]');
    await page.click('[data-testid="remote-issue-picker-result-999"]');
    await page.waitForFunction(() => document.body.textContent?.includes('#999'));

    // --- Invalid ID input: no network call, validation message shown ---
    let networkCalled = false;
    await page.unroute(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`);
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`, async (route) => {
      networkCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForFunction(() => document.body.textContent?.includes('Enter a valid issue id'));
    expect(networkCalled).toBe(false);

    // --- ID not found ---
    await page.unroute(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`);
    await mockOpenProject(page, { onById: () => ({ status: 404, body: {} }) });
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('12345');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('No issue was found with that id'),
    );

    // --- Network/remote failure ---
    await page.unroute(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`);
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`, async (route) => {
      await route.abort('failed');
    });
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('The tracker could not be reached'),
    );

    // --- Bounded title results: mocked backend returns more than the cap; UI must still cap at 25 ---
    await page.unroute(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`);
    const oversized = Array.from({ length: 40 }, (_, i) => ({
      id: String(i + 1),
      subject: `Bounded Issue ${i + 1}`,
    }));
    await mockOpenProject(page, {
      onSearch: () => ({ status: 200, body: workPackagesPayload(oversized) }),
    });
    await page
      .locator('[data-testid="remote-issue-picker-mode"]')
      .getByRole('radio', { name: /title/i })
      .click();
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('Bounded');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-results"]');
    const resultCount = await page
      .locator('[data-testid="remote-issue-picker-results"] li')
      .count();
    expect(resultCount).toBeLessThanOrEqual(25);

    await page.close();
    expect(taskId).toBeTruthy();
  });
});
