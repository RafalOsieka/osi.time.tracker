import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import type { Locator, Page } from 'playwright-core';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUsers } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin, type CookieJar } from '../helpers/auth';

const describeRemoteIssuePickerUI = requireBrowser();

const OPENPROJECT_BASE_URL = 'https://op.remote-issue-picker-ui.example.com';

describeRemoteIssuePickerUI('remote issue picker UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'remoteissuepickerui@example.com', displayName: 'remoteissuepickeruiuser' },
  ]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

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
    const tracker = await createTracker(jar, token, `${label} Tracker ${Date.now()}`, {
      baseUrl: OPENPROJECT_BASE_URL,
      systemType: 'openproject',
      executionMode: 'client',
    });
    const projectId = await createProject(jar, token, `${label} Project ${Date.now()}`, tracker.id);
    const taskId = await createTaskViaEntry(jar, token, `${label} Task ${Date.now()}`, projectId);
    return { jar, token, taskId };
  }

  async function dismissRemoteIssuePicker(page: Page) {
    await page.keyboard.press('Escape');
    await page.locator('[data-testid="remote-issue-picker-query"]').waitFor({ state: 'hidden' });
  }

  async function openRemoteIssuePicker(group: Locator) {
    const page = group.page();
    if ((await page.locator('[data-testid="remote-issue-picker-query"]').count()) > 0) {
      await dismissRemoteIssuePicker(page);
    }
    const link = group.locator('[data-testid^="timer-group-remote-issue-link-"]');
    if ((await link.count()) > 0) {
      await link.first().hover();
      await group.locator('[data-testid="remote-issue-picker-edit-menu"]').waitFor({
        state: 'visible',
      });
      await group.locator('[data-testid="remote-issue-picker-trigger"]').click();
      return;
    }
    await group
      .locator(
        '[data-testid="remote-issue-picker-trigger"], [data-testid^="timer-group-remote-issue-unlinked-"]',
      )
      .first()
      .click();
  }

  /**
   * After a day-scoped reassignment the task/group id changes. Read the new
   * key from the remote-issue link (or unlinked badge) test id suffix.
   */
  async function groupKeyFromIssueLink(page: Page): Promise<string> {
    const key = await page.evaluate(() => {
      const linked = document.querySelector('[data-testid^="timer-group-remote-issue-link-"]');
      if (linked) {
        return linked.getAttribute('data-testid')!.slice('timer-group-remote-issue-link-'.length);
      }
      const unlinked = document.querySelector(
        '[data-testid^="timer-group-remote-issue-unlinked-"]',
      );
      if (unlinked) {
        return unlinked
          .getAttribute('data-testid')!
          .slice('timer-group-remote-issue-unlinked-'.length);
      }
      return null;
    });
    if (!key) throw new Error('issue link/unlinked badge not found');
    return key;
  }

  it('6.1 searches by title, links, replaces, and unlinks a remote issue reference', async () => {
    const { taskId } = await setupClientAndTask('Title');
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

    // Locate the newly created task's row via its task id (pre-link).
    await page.reload();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForSelector(`[data-testid="timer-group-${taskId}"]`);

    let groupKey = taskId;
    let group = page.locator(`[data-testid="timer-group-${groupKey}"]`);

    await openRemoteIssuePicker(group);
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');

    const idMode = page
      .locator('[data-testid="remote-issue-picker-mode"]')
      .getByRole('radio', { name: /id/i });
    const idChecked =
      (await idMode.getAttribute('aria-checked')) === 'true' ||
      (await idMode.getAttribute('data-state')) === 'checked';
    expect(idChecked).toBe(true);
    const queryFocused = await page.evaluate(() => {
      const active = document.activeElement;
      return (
        !!active?.closest('[data-testid="remote-issue-picker-query"]') ||
        active?.getAttribute('data-testid') === 'remote-issue-picker-query'
      );
    });
    expect(queryFocused).toBe(true);

    await page
      .locator('[data-testid="remote-issue-picker-mode"]')
      .getByRole('radio', { name: /title/i })
      .click();

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
    await dismissRemoteIssuePicker(page);

    // Day-scoped reassignment changes the group key; wait by issue label.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid^="timer-group-remote-issue-link-"]')
          ?.textContent?.trim() === '#111',
    );
    groupKey = await groupKeyFromIssueLink(page);
    group = page.locator(`[data-testid="timer-group-${groupKey}"]`);
    const linkText = await page.textContent(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
    );
    expect(linkText?.trim()).toBe('#111');
    const href = await page.getAttribute(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
      'href',
    );
    expect(href).toBe(`${OPENPROJECT_BASE_URL}/work_packages/111`);
    const accessibleName = await page.getAttribute(
      `[data-testid="timer-group-remote-issue-link-${groupKey}"]`,
      'aria-label',
    );
    expect(accessibleName).toContain('First Match');

    // --- Replace the link with a new selection ---
    await mockOpenProject(page, {
      onSearch: () => ({
        status: 200,
        body: workPackagesPayload([{ id: '222', subject: 'Second Match' }]),
      }),
    });
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
      .fill('Sec');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-222"]');
    await page.click('[data-testid="remote-issue-picker-result-222"]');
    await dismissRemoteIssuePicker(page);

    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid^="timer-group-remote-issue-link-"]')
          ?.textContent?.trim() === '#222',
    );
    groupKey = await groupKeyFromIssueLink(page);
    group = page.locator(`[data-testid="timer-group-${groupKey}"]`);

    // --- Unlink from the hover dropdown, not the popover ---
    await group.locator('[data-testid^="timer-group-remote-issue-link-"]').first().hover();
    await group.locator('[data-testid="remote-issue-picker-edit-menu"]').waitFor({
      state: 'visible',
    });
    expect(await page.locator('[data-testid="remote-issue-picker-query"]').count()).toBe(0);
    await group.locator('[data-testid="remote-issue-picker-unlink"]').click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-testid^="timer-group-remote-issue-link-"]') &&
        !!document.querySelector('[data-testid^="timer-group-remote-issue-unlinked-"]'),
    );

    await page.close();
  });

  it('6.1/6.2 searches by exact id, and 6.2 covers validation, not-found, network failure, and bounded results', async () => {
    const { taskId } = await setupClientAndTask('IdSearch');
    const page = await loginAsInBrowser('remoteissuepickerui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForSelector(`[data-testid="timer-group-${taskId}"]`);

    let groupKey = taskId;
    let group = page.locator(`[data-testid="timer-group-${groupKey}"]`);

    // --- Exact-ID search success ---
    await mockOpenProject(page, {
      onById: (id) => ({ status: 200, body: { id, subject: 'Exact Issue' } }),
    });
    await openRemoteIssuePicker(group);
    await page.waitForSelector('[data-testid="remote-issue-picker-mode"]');

    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('999');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForSelector('[data-testid="remote-issue-picker-result-999"]');
    await page.click('[data-testid="remote-issue-picker-result-999"]');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid^="timer-group-remote-issue-link-"]')
          ?.textContent?.trim() === '#999',
    );
    groupKey = await groupKeyFromIssueLink(page);
    group = page.locator(`[data-testid="timer-group-${groupKey}"]`);
    await page.waitForSelector(`[data-testid="timer-group-remote-issue-link-${groupKey}"]`);
    // Close any leftover popover from the pre-reassign group instance.
    await page.keyboard.press('Escape');

    async function openPickerOnCurrentGroup() {
      await openRemoteIssuePicker(group);
      await page.waitForSelector('[data-testid="remote-issue-picker-query"]', {
        state: 'visible',
      });
    }

    async function fillQuery(value: string) {
      const locator = page
        .locator(
          '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
        )
        .first();
      await locator.waitFor({ state: 'visible' });
      await locator.fill(value);
    }

    // --- Invalid ID input: no network call, validation message shown ---
    let networkCalled = false;
    await page.unroute(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`);
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`, async (route) => {
      networkCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await openPickerOnCurrentGroup();
    await page
      .locator('[data-testid="remote-issue-picker-mode"]')
      .getByRole('radio', { name: /id/i })
      .click();
    await fillQuery('');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForFunction(() => document.body.textContent?.includes('Enter a valid issue id'));
    expect(networkCalled).toBe(false);

    // --- ID not found ---
    await page.unroute(`${OPENPROJECT_BASE_URL}/api/v3/work_packages**`);
    await mockOpenProject(page, { onById: () => ({ status: 404, body: {} }) });
    await fillQuery('12345');
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
    await fillQuery('Bounded');
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
