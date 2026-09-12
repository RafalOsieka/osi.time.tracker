import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import type { Page } from 'playwright-core';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin, type CookieJar } from '../helpers/auth';
import { pageIncludesTextScript } from '../helpers/dom';
import { createProject, createTracker } from '../helpers/http';
import {
  installExtension,
  installLostCreateExtension,
  installUnavailableExtension,
  readFakeExtensionState,
} from '../helpers/fake-extension';
import { EXTENSION_RESOURCE_LIMITS } from '@osi/extension-protocol';
import {
  PENDING_CREATE_STORAGE_KEY,
  pendingCreateMarkerSchema,
} from '../../../app/utils/remote/pending-creates';
import type { JsonObject } from '@osi/remote-trackers/contracts';
import { z } from 'zod';

const describeExtensionModeUi = requireBrowser();
const pageIncludesText = pageIncludesTextScript();

const OPENPROJECT_BASE_URL = 'https://op.extension-mode-ui.example.com';
const TRACKER_SECRET = 'e2e-extension-secret';

describeExtensionModeUi('extension execution mode UI', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function setTimezone(jar: CookieJar, token: string) {
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({ timezone: 'UTC' }),
    });
  }

  async function createEntry(jar: CookieJar, token: string, body: JsonObject) {
    const res = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  async function seedBrowserSecret(page: Page, configId: string) {
    await page.evaluate(({ id, secret }) => window.localStorage.setItem(`rsc:${id}`, secret), {
      id: configId,
      secret: TRACKER_SECRET,
    });
  }

  async function loginPage(email: string, install: (page: Page) => Promise<void>) {
    const page = await createPage('/');
    await install(page);
    await fillLogin(page, email, 'secret', { height: 900 });
    return page;
  }

  /** Creates `count` tasks with entries on `startedAt`'s day, each linked to a distinct remote issue. */
  async function seedLinkedTasks(
    jar: CookieJar,
    token: string,
    projectId: string,
    count: number,
    startedAt: string,
    stoppedAt: string,
  ): Promise<string[]> {
    const taskIds: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const entry = await createEntry(jar, token, {
        title: `Burst Task ${index} ${Date.now()}`,
        projectId,
        startedAt,
        stoppedAt,
      });
      const linkRes = await fetch(url('/api/time-entries/reassign'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'csrf-token': token,
          cookie: jar.header(),
        },
        body: JSON.stringify({
          ids: [entry.id],
          remoteIssueId: `${100 + index}`,
          cachedTitle: `Remote Issue ${100 + index}`,
        }),
      });
      const linked = await linkRes.json();
      taskIds.push(linked[0]?.taskId ?? entry.taskId);
    }
    return taskIds;
  }

  it('blocks remote picker, sync, and reports actions until the extension is available', async () => {
    const user = await seedUser(dbUrl, { displayName: 'extensionunavailable' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Extension Unavailable ' + Date.now(), {
      baseUrl: OPENPROJECT_BASE_URL,
      directBrowserAccess: false,
    });
    const project = await createProject(
      jar,
      token,
      'Extension Unavailable Project ' + Date.now(),
      tracker.id,
    );
    const startedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const stoppedAt = new Date().toISOString();
    const title = 'Extension Unavailable Task ' + Date.now();
    const entry = await createEntry(jar, token, {
      title,
      projectId: project.id,
      startedAt,
      stoppedAt,
    });
    const linkRes = await fetch(url('/api/time-entries/reassign'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({
        ids: [entry.id],
        remoteIssueId: '42',
        cachedTitle: 'Linked Issue',
      }),
    });
    const linkedEntries = await linkRes.json();
    const taskId = linkedEntries[0]?.taskId ?? entry.taskId;
    const dayKey = startedAt.slice(0, 10);

    const page = await loginPage(user.email, installUnavailableExtension);
    await seedBrowserSecret(page, tracker.id);
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, title);

    const group = page.locator(`[data-testid="timer-group-${taskId}"]`);
    const linked = group.locator('[data-testid^="timer-group-remote-issue-link-"]');
    if ((await linked.count()) > 0) {
      await linked.first().hover();
      await group.locator('[data-testid="remote-issue-picker-edit-menu"]').waitFor({
        state: 'visible',
      });
    }
    await group
      .locator('[data-testid="remote-issue-picker-trigger"]')
      .evaluate((el: HTMLElement) => {
        el.click();
      });
    await page.waitForSelector('[data-testid="remote-issue-picker-query"]');
    expect(await page.locator('[data-testid="tracker-extension-status"]').count()).toBe(0);
    await page
      .locator(
        '[data-testid="remote-issue-picker-query"] input, [data-testid="remote-issue-picker-query"]',
      )
      .first()
      .fill('abc');
    await page.click('[data-testid="remote-issue-picker-submit"]');
    await page.waitForFunction(() =>
      /not available|niedostępne/i.test(document.body.textContent ?? ''),
    );

    await page.goto(url(`/sync/${dayKey}`));
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    await page.waitForSelector(`[data-testid="remote-sync-activity-error-${taskId}"]`);
    expect(await page.locator('[data-testid="remote-sync-export-button"]').isDisabled()).toBe(true);

    await page.goto(url(`/reports/monthly?month=${dayKey.slice(0, 7)}`));
    await page.waitForSelector('[data-testid="reports-monthly"]');
    await page.waitForSelector('[data-testid="reports-monthly-table-ready"]');
    await page.waitForFunction(() =>
      /Could not load|Nie wczytano/i.test(
        document.querySelector('[data-testid="reports-summary-remote"]')?.textContent ?? '',
      ),
    );

    await page.close();
  });

  it('treats a lost create reply as uncertain, keeps a secret-free marker, and warns on retry', async () => {
    const user = await seedUser(dbUrl, { displayName: 'extensionlostcreate' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Extension Lost Create ' + Date.now(), {
      baseUrl: OPENPROJECT_BASE_URL,
      directBrowserAccess: false,
    });
    const project = await createProject(
      jar,
      token,
      'Extension Lost Create Project ' + Date.now(),
      tracker.id,
    );
    const startedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const stoppedAt = new Date().toISOString();
    const title = 'Extension Lost Create Task ' + Date.now();
    const entry = await createEntry(jar, token, {
      title,
      projectId: project.id,
      startedAt,
      stoppedAt,
    });
    const linkRes = await fetch(url('/api/time-entries/reassign'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({
        ids: [entry.id],
        remoteIssueId: '42',
        cachedTitle: 'Linked Issue',
      }),
    });
    const linkedEntries = await linkRes.json();
    const taskId = linkedEntries[0]?.taskId ?? entry.taskId;
    const dayKey = startedAt.slice(0, 10);

    const page = await loginPage(user.email, installLostCreateExtension);
    await seedBrowserSecret(page, tracker.id);

    const trackerPosts: string[] = [];
    await page.route(`${OPENPROJECT_BASE_URL}/api/v3/time_entries**`, async (route) => {
      if (route.request().method() === 'POST') {
        trackerPosts.push(route.request().postData() ?? '');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 9001 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ _embedded: { elements: [] } }),
      });
    });

    await page.goto(url(`/sync/${dayKey}`));
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    await page.waitForFunction(pageIncludesText, title);
    await page.waitForSelector(`[data-testid="remote-sync-activity-select-${taskId}"]`);
    await page.locator(`[data-testid="remote-sync-activity-select-${taskId}"]`).click();
    await page.getByRole('option', { name: 'Development' }).click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="remote-sync-export-button"]');
      return btn instanceof HTMLButtonElement && !btn.disabled;
    });

    await page.click('[data-testid="remote-sync-export-button"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog-body"]');
    await page.click('[data-testid="remote-sync-export-confirm"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() =>
      /were not exported|nie została wyeksportowana/i.test(document.body.textContent ?? ''),
    );

    const fakeState = await readFakeExtensionState(page);
    expect(fakeState.creates).toBe(1);
    expect(fakeState.seenSecrets).toContain(TRACKER_SECRET);
    expect(trackerPosts).toHaveLength(1);
    expect(trackerPosts[0]).not.toContain(TRACKER_SECRET);

    const markersRaw = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PENDING_CREATE_STORAGE_KEY,
    );
    expect(markersRaw).toBeTruthy();
    expect(markersRaw).not.toContain(TRACKER_SECRET);
    const markersUnknown: unknown = JSON.parse(markersRaw ?? '[]');
    const markers = z.array(pendingCreateMarkerSchema).parse(markersUnknown);
    expect(markers[0]?.trackerId).toBe(tracker.id);
    expect(markers[0]?.taskId).toBe(taskId);
    expect(markers[0]?.spentOn).toBe(dayKey);
    expect((await readFakeExtensionState(page)).creates).toBe(1);

    await page.reload();
    const markersAfterReload = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PENDING_CREATE_STORAGE_KEY,
    );
    expect(markersAfterReload).toBe(markersRaw);
    expect(markersAfterReload).not.toContain(TRACKER_SECRET);

    await page.close();
  });

  it('loads a day with more linked tasks than the extension in-flight limit without any limit error (REQ-331)', async () => {
    const user = await seedUser(dbUrl, { displayName: 'extensionburstredmine' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Extension Burst Redmine ' + Date.now(), {
      baseUrl: OPENPROJECT_BASE_URL,
      systemType: 'redmine',
      directBrowserAccess: false,
    });
    const project = await createProject(
      jar,
      token,
      'Extension Burst Redmine Project ' + Date.now(),
      tracker.id,
    );
    const startedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const stoppedAt = new Date().toISOString();
    const dayKey = startedAt.slice(0, 10);
    const taskCount = EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument + 2;
    const taskIds = await seedLinkedTasks(jar, token, project.id, taskCount, startedAt, stoppedAt);

    const page = await loginPage(user.email, (p) => installExtension(p));
    await seedBrowserSecret(page, tracker.id);

    await page.goto(url(`/sync/${dayKey}`));
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    for (const taskId of taskIds) {
      await page.waitForSelector(`[data-testid="remote-sync-activity-select-${taskId}"]`);
    }
    expect(await page.locator('[data-testid^="remote-sync-activity-error-"]').count()).toBe(0);

    const state = await readFakeExtensionState(page);
    expect(state.limitErrors).toBe(0);
    expect(state.maxConcurrent).toBeLessThanOrEqual(
      EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument,
    );
    // Redmine activities are a global enumeration: every task shares one scope.
    expect(state.operationCounts.getActivityOptions).toBe(1);
    expect(state.operationCounts.fetchTimeLogs).toBe(1);
    expect(state.operationCounts.getCurrentAccount ?? 0).toBe(0);

    // Export two of the six tasks; the post-finalize refresh (REQ-118) should
    // cost only more `fetchTimeLogs` calls, never another activity or account
    // fetch, and none of it should hit the in-flight limit either.
    for (const taskId of taskIds.slice(0, 2)) {
      await page.locator(`[data-testid="remote-sync-activity-select-${taskId}"]`).click();
      await page.getByRole('option', { name: 'Development' }).click();
    }
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="remote-sync-export-button"]');
      return btn instanceof HTMLButtonElement && !btn.disabled;
    });
    await page.click('[data-testid="remote-sync-export-button"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog-body"]');
    await page.click('[data-testid="remote-sync-export-confirm"]');
    await page.waitForSelector('[data-testid="remote-sync-export-dialog"]', { state: 'hidden' });

    const afterExport = await readFakeExtensionState(page);
    expect(afterExport.creates).toBe(2);
    expect(afterExport.limitErrors).toBe(0);
    expect(afterExport.operationCounts.getActivityOptions).toBe(1);
    expect(afterExport.operationCounts.getCurrentAccount ?? 0).toBe(0);
    expect(afterExport.operationCounts.fetchTimeLogs).toBeGreaterThan(
      state.operationCounts.fetchTimeLogs ?? 0,
    );

    await page.close();
  });

  it('loads a day with more linked OpenProject tasks than the extension in-flight limit without any limit error', async () => {
    const user = await seedUser(dbUrl, { displayName: 'extensionburstopenproject' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Extension Burst OpenProject ' + Date.now(), {
      baseUrl: OPENPROJECT_BASE_URL,
      directBrowserAccess: false,
    });
    const project = await createProject(
      jar,
      token,
      'Extension Burst OpenProject Project ' + Date.now(),
      tracker.id,
    );
    const startedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const stoppedAt = new Date().toISOString();
    const dayKey = startedAt.slice(0, 10);
    const taskCount = EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument + 2;
    const taskIds = await seedLinkedTasks(jar, token, project.id, taskCount, startedAt, stoppedAt);

    const page = await loginPage(user.email, (p) => installExtension(p));
    await seedBrowserSecret(page, tracker.id);

    await page.goto(url(`/sync/${dayKey}`));
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    for (const taskId of taskIds) {
      await page.waitForSelector(`[data-testid="remote-sync-activity-select-${taskId}"]`);
    }
    expect(await page.locator('[data-testid^="remote-sync-activity-error-"]').count()).toBe(0);

    const state = await readFakeExtensionState(page);
    expect(state.limitErrors).toBe(0);
    expect(state.maxConcurrent).toBeLessThanOrEqual(
      EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument,
    );
    // OpenProject activities depend on the work package: one fetch per task.
    expect(state.operationCounts.getActivityOptions).toBe(taskCount);
    expect(state.operationCounts.getCurrentAccount ?? 0).toBe(0);

    await page.close();
  });
});
