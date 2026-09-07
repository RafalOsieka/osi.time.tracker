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
import { createProject, createTracker } from '../helpers/http';
import { createDatabaseClient } from '../../../server/db/client';
import { remoteExports } from '../../../server/db/schema';
import type { JsonObject } from '../../../shared/types/json';

const describeReportsMonthlyUi = requireBrowser();

const TRACKER_A = 'https://op.reports-a.example.com';
const TRACKER_B = 'https://op.reports-b.example.com';
const TRACKER_FAIL = 'https://op.reports-fail.example.com';

async function setTimezone(jar: CookieJar, token: string): Promise<void> {
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

async function mockAccount(page: Page, origin: string) {
  await page.route(`${origin}/api/v3/users/me**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 7, name: 'Ada' }),
    });
  });
}

async function mockTimeLogs(page: Page, origin: string, body: JsonObject, status = 200) {
  await page.route(`${origin}/api/v3/time_entries**`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

function emptyLogs() {
  return { _embedded: { elements: [] } };
}

function logsOf(entries: { id: number; spentOn: string; hours: string; issueId: string }[]) {
  return {
    _embedded: {
      elements: entries.map((entry) => ({
        id: entry.id,
        spentOn: entry.spentOn,
        hours: entry.hours,
        _links: {
          entity: { href: `/api/v3/work_packages/${entry.issueId}` },
          user: { href: '/api/v3/users/7' },
        },
      })),
    },
  };
}

describeReportsMonthlyUi('monthly timesheet UI', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function openAuthed(email: string) {
    const page = await createPage('/');
    await fillLogin(page, email, 'secret');
    return page;
  }

  it('writes the current month into the query string by default', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const page = await openAuthed(user.email);
    await page.goto(url('/reports/monthly'));
    await page.waitForSelector('[data-testid="reports-monthly"]');
    await page.waitForFunction(() => /month=\d{4}-\d{2}/.test(window.location.search));
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(page.url()).toContain(`month=${month}`);
  });

  it('honors an explicit month, shows empty state, and lists only days with hours', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const trackerA = await createTracker(jar, token, 'Reports A ' + Date.now(), {
      baseUrl: TRACKER_A,
    });
    const trackerB = await createTracker(jar, token, 'Reports B ' + Date.now(), {
      baseUrl: TRACKER_B,
    });
    const project = await createProject(jar, token, 'Reports Project ' + Date.now(), trackerA.id);
    await createEntry(jar, token, {
      title: 'August work',
      projectId: project.id,
      startedAt: '2026-08-03T10:00:00.000Z',
      stoppedAt: '2026-08-03T12:00:00.000Z',
    });

    const page = await openAuthed(user.email);
    await mockAccount(page, TRACKER_A);
    await mockAccount(page, TRACKER_B);
    await mockTimeLogs(page, TRACKER_A, emptyLogs());
    await mockTimeLogs(page, TRACKER_B, emptyLogs());
    await page.evaluate(
      ({ ids }) => {
        for (const id of ids) window.localStorage.setItem(`rsc:${id}`, 'e2e-secret');
      },
      { ids: [trackerA.id, trackerB.id] },
    );

    await page.goto(url('/reports/monthly?month=2019-01'));
    await page.waitForSelector('[data-testid="reports-monthly-empty"]');
    expect(await page.locator('[data-testid="reports-monthly-empty"]').isVisible()).toBe(true);

    await page.goto(url('/reports/monthly?month=2026-08'));
    await page.waitForSelector('[data-testid="reports-monthly-table-ready"]');
    await page.waitForSelector('[data-testid="reports-day-2026-08-03"]');
    expect(await page.locator('[data-testid="reports-day-2026-08-03"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="reports-day-2026-08-04"]').count()).toBe(0);
    expect(await page.locator('[data-testid="reports-local-2026-08-03"]').textContent()).toBe(
      '2:00',
    );
    await page.waitForSelector('[data-testid="reports-summary-remote"]');
    expect(await page.locator('[data-testid="reports-summary-local"]').textContent()).toMatch(
      /2:00/,
    );
    expect(await page.locator('[data-testid="reports-summary-remote"]').textContent()).toMatch(
      /0:00/,
    );
    await page.waitForSelector(`[data-testid="reports-tracker-${trackerB.id}-2026-08-03-total"]`);
    expect(
      await page
        .locator(`[data-testid="reports-tracker-${trackerB.id}-2026-08-03-total"]`)
        .textContent(),
    ).toBe('0:00');
    expect(
      await page.locator(`[data-testid="reports-tracker-group-${trackerA.id}"]`).textContent(),
    ).toBe(trackerA.name);
    expect(
      await page.locator(`[data-testid="reports-tracker-group-${trackerB.id}"]`).textContent(),
    ).toBe(trackerB.name);
  });

  it('splits App vs Direct from routed remote logs and flags attention; fetch failure is not zero', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const trackerA = await createTracker(jar, token, 'Reports Match ' + Date.now(), {
      baseUrl: TRACKER_A,
    });
    const trackerFail = await createTracker(jar, token, 'Reports Fail ' + Date.now(), {
      baseUrl: TRACKER_FAIL,
    });
    const project = await createProject(jar, token, 'Reports Project ' + Date.now(), trackerA.id);
    const entry = await createEntry(jar, token, {
      title: 'Exported work',
      projectId: project.id,
      startedAt: '2026-08-03T10:00:00.000Z',
      stoppedAt: '2026-08-03T11:00:00.000Z',
    });
    const { db, sql } = createDatabaseClient(dbUrl);
    try {
      await db.insert(remoteExports).values({
        userId: user.id,
        taskId: entry.taskId,
        localDate: '2026-08-03',
        remoteIssueId: '42',
        remoteLogId: '11',
        exportDurationSeconds: 3600,
        requiredFieldValues: {},
        exportRequestKey: `er-ui-${Date.now()}`,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }

    const page = await openAuthed(user.email);
    await mockAccount(page, TRACKER_A);
    await mockAccount(page, TRACKER_FAIL);
    await mockTimeLogs(
      page,
      TRACKER_A,
      logsOf([
        { id: 11, spentOn: '2026-08-03', hours: 'PT1H', issueId: '42' },
        { id: 99, spentOn: '2026-08-12', hours: 'PT2H', issueId: '77' },
      ]),
    );
    await mockTimeLogs(page, TRACKER_FAIL, { error: 'nope' }, 500);
    await page.evaluate(
      ({ ids }) => {
        for (const id of ids) window.localStorage.setItem(`rsc:${id}`, 'e2e-secret');
      },
      { ids: [trackerA.id, trackerFail.id] },
    );

    await page.goto(url('/reports/monthly?month=2026-08'));
    await page.waitForSelector('[data-testid="reports-monthly-table-ready"]', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="reports-day-2026-08-12"]');
    expect(
      await page
        .locator(`[data-testid="reports-tracker-${trackerA.id}-2026-08-03-app"]`)
        .textContent(),
    ).toBe('1:00');
    expect(
      await page
        .locator(`[data-testid="reports-tracker-${trackerA.id}-2026-08-03-direct"]`)
        .textContent(),
    ).toBe('0:00');
    await page.waitForSelector('[data-testid="reports-day-2026-08-12"]');
    expect(
      await page
        .locator(`[data-testid="reports-tracker-${trackerA.id}-2026-08-12-direct"]`)
        .textContent(),
    ).toBe('2:00');
    expect(
      await page
        .locator(`[data-testid="reports-warning-2026-08-12-direct-${trackerA.id}"]`)
        .isVisible(),
    ).toBe(true);
    expect(
      await page
        .locator(`[data-testid="reports-tracker-${trackerFail.id}-2026-08-03-total"]`)
        .textContent(),
    ).not.toBe('0:00');
    expect(await page.locator('[data-testid="reports-summary-remote"]').textContent()).toMatch(
      /3:00/,
    );
  });
});
