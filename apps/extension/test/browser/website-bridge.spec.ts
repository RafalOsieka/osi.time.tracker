import { existsSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Page } from 'playwright';
import {
  extensionDistPath,
  launchExtensionContext,
  type ExtensionHarness,
} from './harness/extension-context.js';
import {
  startFakeOpenProject,
  startFakeRedmine,
  type FakeTrackerServer,
} from './harness/fake-trackers.js';
import { startWebsiteFixture, type WebsiteFixture } from './harness/website-fixture.js';
import { requireChromium } from './harness/skip.js';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import { z } from 'zod';

const describeChromium = requireChromium();
const SECRET = 'bridge-secret-token';
const operationResultSchema = z.object({
  type: z.literal('operation-result'),
  ok: z.boolean(),
  result: z.json().optional(),
  error: z.object({ kind: z.string(), messageKey: z.string() }).optional(),
});

declare global {
  interface Window {
    __osiRun?: (message: JsonValue) => Promise<JsonValue>;
  }
}

function optionsUrl(harness: ExtensionHarness): string {
  return `chrome-extension://${harness.extensionId}/src/options/index.html`;
}

async function approveSite(
  harness: ExtensionHarness,
  websiteOrigin: string,
  destinationUrl: string,
  provider: 'openproject' | 'redmine',
): Promise<void> {
  const page = await harness.context.newPage();
  await page.goto(optionsUrl(harness));
  await page.getByTestId('website-origin').fill(websiteOrigin);
  await page.getByTestId('add-website').click();
  await page
    .getByTestId('status')
    .filter({ hasText: /saved|zapisane/i })
    .waitFor();
  await page.getByTestId('destination-provider').selectOption(provider);
  await page.getByTestId('destination-url').fill(destinationUrl);
  await page.getByTestId('add-destination').click();
  await page
    .getByTestId('status')
    .filter({ hasText: /saved|zapisane/i })
    .waitFor();
  await page.close();
}

async function openFixture(harness: ExtensionHarness, url: string): Promise<Page> {
  const page = await harness.context.newPage();
  await page.goto(url);
  await page.getByTestId('fixture-ready').waitFor();
  await page.reload();
  await page.getByTestId('fixture-ready').waitFor();
  return page;
}

async function runOnPage(page: Page, message: JsonValue): Promise<JsonValue> {
  const result = await page.evaluate((payload) => {
    const run = window.__osiRun;
    if (!run) throw new Error('fixture bridge missing');
    return run(payload);
  }, message);
  // SAFETY: the fixture JSON-clones protocol envelopes onto the page.
  return JSON.parse(JSON.stringify(result)) as JsonValue;
}

async function readExtensionStorage(harness: ExtensionHarness): Promise<string> {
  return harness.worker.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
}

describeChromium('website/content/worker bridge', () => {
  let openProject: FakeTrackerServer;
  let redmine: FakeTrackerServer;
  let website: WebsiteFixture;
  let foreign: WebsiteFixture;
  let harness: ExtensionHarness | undefined;

  beforeAll(async () => {
    expect(existsSync(extensionDistPath())).toBe(true);
    openProject = await startFakeOpenProject();
    redmine = await startFakeRedmine();
    website = await startWebsiteFixture();
    foreign = await startWebsiteFixture();
    harness = await launchExtensionContext();
    await approveSite(harness, website.origin, openProject.baseUrl, 'openproject');
    await approveSite(harness, website.origin, redmine.baseUrl, 'redmine');
  });

  afterAll(async () => {
    await harness?.close();
    await website.close();
    await foreign.close();
    await openProject.close();
    await redmine.close();
  });

  it('reaches no-CORS OpenProject and Redmine fixtures through the real content bridge', async () => {
    const page = await openFixture(harness!, website.url);
    const handshake = await runOnPage(page, {
      type: 'handshake',
      protocolVersion: 1,
      destination: { provider: 'openproject', baseUrl: openProject.baseUrl },
    });
    expect(handshake).toMatchObject({
      type: 'handshake-result',
      destinationApproved: true,
    });

    const openProjectHitsBefore = openProject.requests.length;
    const search = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-search',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'searchIssues',
      input: { query: 'Ship' },
    });
    expect(search).toMatchObject({
      ok: true,
      operation: 'searchIssues',
      result: [{ remoteIssueId: '42', title: 'Ship it' }],
    });
    expect(openProject.requests.length).toBeGreaterThan(openProjectHitsBefore);

    const lookup = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-id',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'getIssueById',
      input: { remoteIssueId: '42' },
    });
    expect(lookup).toMatchObject({
      ok: true,
      result: { result: { remoteIssueId: '42' }, inScope: true },
    });

    const activities = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-act',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'getActivityOptions',
      input: '42',
    });
    expect(activities).toMatchObject({
      ok: true,
      result: [{ id: '1', name: 'Development' }],
    });

    const account = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-acc',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'getCurrentAccount',
      input: null,
    });
    expect(account).toMatchObject({ ok: true, result: { id: '7', name: 'Ada' } });

    const logs = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-logs',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'fetchTimeLogs',
      input: { spentOn: '2026-03-15', workPackageIds: ['42'], userId: '7' },
    });
    const parsedLogs = operationResultSchema.parse(logs);
    expect(parsedLogs.ok).toBe(true);
    expect(Array.isArray(parsedLogs.result) ? parsedLogs.result.length : 0).toBeGreaterThan(0);

    const range = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-range',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'fetchTimeLogsInRange',
      input: { from: '2026-03-01', to: '2026-03-31', userId: '7' },
    });
    expect(range).toMatchObject({ ok: true });

    const create = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-create',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'createTimeEntry',
      input: {
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      },
    });
    expect(create).toMatchObject({ ok: true, result: { remoteLogId: '9001' } });
    const createPosts = openProject.requests.filter(
      (item) => item.method === 'POST' && item.url.split('?')[0] === '/api/v3/time_entries',
    );
    expect(createPosts).toHaveLength(1);

    const redmineHitsBefore = redmine.requests.length;
    const redmineAccount = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-acc',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'getCurrentAccount',
      input: null,
    });
    expect(redmineAccount).toMatchObject({ ok: true, result: { id: '7' } });
    const redmineSearch = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-search',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'searchIssues',
      input: { query: 'Ship' },
    });
    expect(redmineSearch).toMatchObject({ ok: true, result: [{ remoteIssueId: '42' }] });
    const redmineLookup = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-id',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'getIssueById',
      input: { remoteIssueId: '42' },
    });
    expect(redmineLookup).toMatchObject({ ok: true });
    const redmineActivities = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-act',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'getActivityOptions',
      input: '42',
    });
    expect(redmineActivities).toMatchObject({ ok: true });
    const redmineLogs = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-logs',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'fetchTimeLogs',
      input: { spentOn: '2026-03-15', workPackageIds: ['42'], userId: '7' },
    });
    expect(redmineLogs).toMatchObject({ ok: true });
    const redmineRange = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-range',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'fetchTimeLogsInRange',
      input: { from: '2026-03-01', to: '2026-03-31', userId: '7' },
    });
    expect(redmineRange).toMatchObject({ ok: true });
    const redmineCreate = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-rm-create',
      provider: 'redmine',
      baseUrl: redmine.baseUrl,
      secret: SECRET,
      operation: 'createTimeEntry',
      input: {
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      },
    });
    expect(redmineCreate).toMatchObject({ ok: true, result: { remoteLogId: '9001' } });
    expect(redmine.requests.length).toBeGreaterThan(redmineHitsBefore);

    const stored = await readExtensionStorage(harness!);
    expect(stored).not.toContain(SECRET);
    await page.close();
  });

  it.each(['openproject', 'redmine'] as const)(
    'reports an unknown create from the real %s worker after the tracker loses its reply',
    async (provider) => {
      const tracker = await (provider === 'openproject' ? startFakeOpenProject : startFakeRedmine)({
        dropCreateResponse: true,
      });
      const page = await openFixture(harness!, website.url);
      try {
        await approveSite(harness!, website.origin, tracker.baseUrl, provider);
        const result = await runOnPage(page, {
          type: 'operation',
          requestId: `lost-${provider}`,
          provider,
          baseUrl: tracker.baseUrl,
          secret: SECRET,
          operation: 'createTimeEntry',
          input: {
            remoteIssueId: '42',
            spentOn: '2026-03-15',
            durationSeconds: 1800,
            activityId: '1',
          },
        });
        expect(result).toMatchObject({ ok: false, error: { kind: 'unknown-create' } });
        expect(tracker.createdLogIds).toEqual([9001]);
        await page.reload();
        await runOnPage(page, { type: 'handshake', protocolVersion: 1 });
        expect(tracker.createdLogIds).toEqual([9001]);
        expect(await readExtensionStorage(harness!)).not.toContain(SECRET);
      } finally {
        await page.close();
        await tracker.close();
      }
    },
  );

  it.each(['pagination', 'redirect'] as const)(
    'blocks a response-derived %s destination without sending credentials there',
    async (kind) => {
      const forbidden = await startFakeOpenProject();
      const tracker = await startFakeOpenProject(
        kind === 'pagination'
          ? { nextPageUrl: `${forbidden.baseUrl}/stolen` }
          : { redirectAccountTo: `${forbidden.baseUrl}/stolen` },
      );
      const page = await openFixture(harness!, website.url);
      try {
        await approveSite(harness!, website.origin, tracker.baseUrl, 'openproject');
        const result = await runOnPage(page, {
          type: 'operation',
          requestId: `escape-${kind}`,
          provider: 'openproject',
          baseUrl: tracker.baseUrl,
          secret: SECRET,
          operation: kind === 'pagination' ? 'fetchTimeLogsInRange' : 'getCurrentAccount',
          input: kind === 'pagination' ? { from: '2026-03-01', to: '2026-03-31' } : null,
        });
        expect(result).toMatchObject({ ok: false });
        expect(tracker.requests).toHaveLength(1);
        expect(forbidden.requests).toHaveLength(0);
        expect(JSON.stringify(result)).not.toContain(SECRET);
      } finally {
        await page.close();
        await tracker.close();
        await forbidden.close();
      }
    },
  );

  it('rejects unapproved origins, destinations, malformed messages, and URL escapes', async () => {
    const hitsBefore = openProject.requests.length;
    const foreignPage = await openFixture(harness!, foreign.url);
    let foreignHandshake: JsonValue | 'timeout';
    try {
      foreignHandshake = await runOnPage(foreignPage, {
        type: 'handshake',
        protocolVersion: 1,
      });
    } catch {
      foreignHandshake = 'timeout';
    }
    expect(foreignHandshake).toBeTruthy();
    await foreignPage.close();

    const page = await openFixture(harness!, website.url);
    const unapprovedDestination = await runOnPage(page, {
      type: 'handshake',
      protocolVersion: 1,
      destination: { provider: 'openproject', baseUrl: 'https://evil.example' },
    });
    expect(unapprovedDestination).toMatchObject({ destinationApproved: false });

    const escaped = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-escape',
      provider: 'openproject',
      baseUrl: `${openProject.baseUrl}/%2e%2e/redirect`,
      secret: SECRET,
      operation: 'getCurrentAccount',
      input: null,
    });
    expect(escaped).toMatchObject({ ok: false });

    const malformed = await runOnPage(page, { type: 'operation', nope: true });
    expect(malformed).toMatchObject({ kind: 'malformed' });

    expect(openProject.requests.length).toBe(hitsBefore);

    const options = await harness!.context.newPage();
    await options.goto(optionsUrl(harness!));
    await options.locator(`[data-testid="revoke-website-${website.origin}"]`).click();
    await expect.poll(() => options.getByTestId('status').textContent()).toMatch(/cofni|revoked/i);
    await options.close();

    const afterRevoke = await runOnPage(page, {
      type: 'operation',
      requestId: 'r-revoked',
      provider: 'openproject',
      baseUrl: openProject.baseUrl,
      secret: SECRET,
      operation: 'createTimeEntry',
      input: {
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      },
    });
    expect(afterRevoke).toMatchObject({ ok: false });
    expect(
      openProject.requests.filter(
        (item) => item.method === 'POST' && item.url.split('?')[0] === '/api/v3/time_entries',
      ),
    ).toHaveLength(1);
    await page.close();
  });
});
