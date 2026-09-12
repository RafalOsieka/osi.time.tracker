import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin, type CookieJar } from '../helpers/auth';
import { createProject, createTracker } from '../helpers/http';
import { pageIncludesTextScript } from '../helpers/dom';
import type { JsonObject } from '@osi/remote-trackers/contracts';

const describeTrackerImportUi = requireBrowser();
const pageIncludesText = pageIncludesTextScript();

const TRACKER_BASE_URL = 'https://op.import-ui.example.com';
const TRACKER_SECRET = 'e2e-import-secret';

async function setTimezone(jar: CookieJar, token: string): Promise<void> {
  await fetch(url('/api/user/settings'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ timezone: 'UTC' }),
  });
}

async function seedBrowserSecret(page: Page, trackerId: string): Promise<void> {
  await page.evaluate(({ id, secret }) => window.localStorage.setItem(`rsc:${id}`, secret), {
    id: trackerId,
    secret: TRACKER_SECRET,
  });
}

interface FakeOpenProjectCatalogElement {
  id: string;
  name: string;
  _links?: { parent: { href: string } };
}

/** Registers the OpenProject remote-project catalog route (REQ-318). */
async function mockCatalog(
  page: Page,
  origin: string,
  projects: { id: string; name: string; parentId?: string }[],
): Promise<void> {
  await page.route(`${origin}/api/v3/projects**`, async (route) => {
    const elements = projects.map((project): FakeOpenProjectCatalogElement => {
      const element: FakeOpenProjectCatalogElement = { id: project.id, name: project.name };
      if (project.parentId) {
        element._links = { parent: { href: `/api/v3/projects/${project.parentId}` } };
      }
      return element;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: projects.length,
        count: projects.length,
        pageSize: 100,
        offset: 1,
        _embedded: { elements },
      }),
    });
  });
}

interface ImportLogFixture {
  id: number;
  spentOn: string;
  hours: string;
  comment: string;
  issueId: string;
  projectId: string;
}

function timeEntriesPayload(entries: ImportLogFixture[]): JsonObject {
  return {
    _embedded: {
      elements: entries.map((entry) => ({
        id: entry.id,
        spentOn: entry.spentOn,
        hours: entry.hours,
        comment: { raw: entry.comment },
        _links: {
          entity: { href: `/api/v3/work_packages/${entry.issueId}` },
          project: { href: `/api/v3/projects/${entry.projectId}` },
          user: { href: '/api/v3/users/7' },
        },
      })),
    },
  };
}

/** Serves month-specific date-range logs by reading the `spent_on` filter, so a two-month import scan sees different fixtures per month (REQ-296/REQ-334). */
async function mockRangeLogsByMonth(
  page: Page,
  origin: string,
  byMonth: Record<string, ImportLogFixture[]>,
  options: { failMonth?: string } = {},
): Promise<void> {
  await page.route(`${origin}/api/v3/time_entries**`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const requestUrl = new URL(route.request().url());
    // SAFETY: this test always sends a well-formed `filters` array it built itself.
    const filters = JSON.parse(requestUrl.searchParams.get('filters') ?? '[]') as {
      spent_on?: { values?: string[] };
    }[];
    const from = filters.find((f) => f.spent_on)?.spent_on?.values?.[0] ?? '';
    const monthKey = from.slice(0, 7);
    if (options.failMonth && monthKey === options.failMonth) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(timeEntriesPayload(byMonth[monthKey] ?? [])),
    });
  });
}

async function openImportDialog(page: Page, trackerId: string): Promise<void> {
  await page.click('[data-testid="app-sidebar"] a[href="/trackers"]');
  await page.waitForSelector('[data-testid="trackers-page"]');
  await page.click(`[data-testid="import-tracker-${trackerId}"]`);
  await page.waitForSelector('[data-testid="tracker-import-dialog"]');
}

async function fillRangeAndScan(page: Page, from: string, to: string): Promise<void> {
  await page.fill('[data-testid="tracker-import-from-input"]', from);
  await page.fill('[data-testid="tracker-import-to-input"]', to);
  await page.click('[data-testid="tracker-import-scan"]');
}

describeTrackerImportUi('tracker remote-log import UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('scans two months, previews routed and unmatched logs, imports, and shows up in the timer view and Remote Sync', async () => {
    const user = await seedUser(dbUrl, { displayName: 'importuiflow' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Import UI Tracker ' + Date.now(), {
      baseUrl: TRACKER_BASE_URL,
      systemType: 'openproject',
      directBrowserAccess: true,
    });
    const projectWeb = await createProject(jar, token, 'Import UI Web ' + Date.now(), tracker.id, {
      remoteProjectId: '12',
      remoteProjectTitle: 'CMPL Web',
    });
    const projectMobile = await createProject(
      jar,
      token,
      'Import UI Mobile ' + Date.now(),
      tracker.id,
      { remoteProjectId: '40', remoteProjectTitle: 'Mobile' },
    );

    const page = await createPage('/');
    await seedBrowserSecret(page, tracker.id);
    await mockCatalog(page, TRACKER_BASE_URL, [
      { id: '12', name: 'CMPL Web' },
      { id: '40', name: 'Mobile' },
      { id: '99', name: 'Sales' },
    ]);
    const commentWeb = 'Fix invoice rounding ' + Date.now();
    const commentSales = 'Unrouted sales work ' + Date.now();
    await mockRangeLogsByMonth(page, TRACKER_BASE_URL, {
      '2026-08': [
        {
          id: 501,
          spentOn: '2026-08-03',
          hours: 'PT2H',
          comment: commentWeb,
          issueId: '1001',
          projectId: '12',
        },
        {
          id: 502,
          spentOn: '2026-08-04',
          hours: 'PT1H',
          comment: 'Mobile task',
          issueId: '2001',
          projectId: '40',
        },
      ],
      '2026-09': [
        {
          id: 503,
          spentOn: '2026-09-02',
          hours: 'PT3H',
          comment: commentSales,
          issueId: '3001',
          projectId: '99',
        },
      ],
    });
    await fillLogin(page, user.email, user.password, { height: 900 });

    await openImportDialog(page, tracker.id);
    await fillRangeAndScan(page, '2026-08-01', '2026-09-30');
    await page.waitForSelector('[data-testid="tracker-import-preview"]');

    const totalsText = await page.textContent('[data-testid="tracker-import-preview-totals"]');
    expect(totalsText).toContain('3');
    await page.waitForSelector('[data-testid="tracker-import-unmatched-hint"]');
    const previewText = await page.textContent('[data-testid="tracker-import-preview"]');
    expect(previewText).toContain('Sales');
    expect(previewText).toContain(projectWeb.name);
    expect(previewText).toContain(projectMobile.name);

    await page.click('[data-testid="tracker-import-confirm"]');
    await page.waitForSelector('[data-testid="tracker-import-done"]');
    expect(await page.textContent('[data-testid="tracker-import-done-imported"]')).toBe('3');
    await page.click('[data-testid="tracker-import-close"]');
    await page.waitForSelector('[data-testid="tracker-import-dialog"]', { state: 'hidden' });

    // Imported entries show up in the timer view under the comment-derived task name.
    await page.click('[data-testid="app-sidebar"] a[href="/"]');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, commentWeb);
    await page.waitForFunction(pageIncludesText, 'Mobile task');

    // The backfilled day shows as Sent on the Remote Sync review (REQ-344).
    await page.goto(new URL('/sync/2026-08-03', page.url()).href);
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-testid^="remote-sync-state-"]')].some(
        (el) => el.textContent?.includes('Sent') || el.textContent?.includes('Wysłane'),
      ),
    );

    // Re-running the same import over the same range skips every log (REQ-338).
    await openImportDialog(page, tracker.id);
    await fillRangeAndScan(page, '2026-08-01', '2026-09-30');
    await page.waitForSelector('[data-testid="tracker-import-preview"]');
    const rerunTotals = await page.textContent('[data-testid="tracker-import-preview-totals"]');
    expect(rerunTotals).toContain('0');
    await page.click('[data-testid="tracker-import-back"]');
    await page.click('[data-testid="tracker-import-cancel"]');

    await page.close();
  });

  it('stops when the second month fails to import, states the first month is already committed, and retry resumes past it', async () => {
    const user = await seedUser(dbUrl, { displayName: 'importuiretry' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Import Retry Tracker ' + Date.now(), {
      baseUrl: TRACKER_BASE_URL,
      systemType: 'openproject',
      directBrowserAccess: true,
    });
    await createProject(jar, token, 'Import Retry Project ' + Date.now(), tracker.id, {
      remoteProjectId: '12',
      remoteProjectTitle: 'CMPL Web',
    });

    const page = await createPage('/');
    await seedBrowserSecret(page, tracker.id);
    await mockCatalog(page, TRACKER_BASE_URL, [{ id: '12', name: 'CMPL Web' }]);
    const comment = 'Retry flow task ' + Date.now();
    await mockRangeLogsByMonth(page, TRACKER_BASE_URL, {
      '2026-08': [
        {
          id: 601,
          spentOn: '2026-08-05',
          hours: 'PT1H',
          comment,
          issueId: '5001',
          projectId: '12',
        },
      ],
      '2026-09': [
        {
          id: 602,
          spentOn: '2026-09-05',
          hours: 'PT1H',
          comment,
          issueId: '5002',
          projectId: '12',
        },
      ],
    });

    // Fail only the first write attempt covering September; every other
    // request (dry runs, August's write, and the retried September write)
    // reaches the real server unchanged.
    let failedSeptemberOnce = false;
    await page.route(`**/api/trackers/${tracker.id}/import`, async (route) => {
      // SAFETY: this route only ever sees this test's own import request body.
      const body = route.request().postDataJSON() as {
        dryRun: boolean;
        groups: { logs: { spentOn: string }[] }[];
      };
      const coversSeptember = body.groups.some((group) =>
        group.logs.some((log) => log.spentOn.startsWith('2026-09')),
      );
      if (!body.dryRun && coversSeptember && !failedSeptemberOnce) {
        failedSeptemberOnce = true;
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });

    await fillLogin(page, user.email, user.password, { height: 900 });

    await openImportDialog(page, tracker.id);
    await fillRangeAndScan(page, '2026-08-01', '2026-09-30');
    await page.waitForSelector('[data-testid="tracker-import-preview"]');

    await page.click('[data-testid="tracker-import-confirm"]');
    await page.waitForSelector('[data-testid="tracker-import-error"]');
    const committedText = await page.textContent('[data-testid="tracker-import-committed-months"]');
    expect(committedText).toContain('1');

    await page.click('[data-testid="tracker-import-retry"]');
    await page.waitForSelector('[data-testid="tracker-import-done"]');
    // Only September's log is newly imported this time; August's was already
    // committed on the first attempt and is skipped, not recreated.
    expect(await page.textContent('[data-testid="tracker-import-done-imported"]')).toBe('1');
    expect(await page.textContent('[data-testid="tracker-import-done-linked"]')).toBe('1');

    await page.close();
  });
});
