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
import { installExtension, readFakeExtensionState } from '../helpers/fake-extension';

const describeTrackerImportExtensionUi = requireBrowser();
const pageIncludesText = pageIncludesTextScript();

const TRACKER_BASE_URL = 'https://op.import-ext-ui.example.com';
const TRACKER_SECRET = 'e2e-import-ext-secret';

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

describeTrackerImportExtensionUi('tracker remote-log import UI flow (extension mode)', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('repeats the import journey through the approved extension and reaches the same result', async () => {
    const user = await seedUser(dbUrl, { displayName: 'importuiextension' });
    const { jar, token } = await apiLogin(user.email, user.password);
    await setTimezone(jar, token);
    const tracker = await createTracker(jar, token, 'Import Ext Tracker ' + Date.now(), {
      baseUrl: TRACKER_BASE_URL,
      systemType: 'openproject',
      directBrowserAccess: false,
    });
    const project = await createProject(
      jar,
      token,
      'Import Ext Project ' + Date.now(),
      tracker.id,
      {
        remoteProjectId: '12',
        remoteProjectTitle: 'CMPL Web',
      },
    );

    const comment = 'Extension mode import task ' + Date.now();
    const page = await createPage('/');
    // The extension only routes the request through the approved tracker
    // destination; a browser-held secret is still required (REQ-203/REQ-345).
    await installExtension(page, {
      projects: [{ remoteProjectId: '12', title: 'CMPL Web' }],
      timeLogsInRange: [
        {
          remoteLogId: 'ext-501',
          remoteIssueId: '1001',
          spentOn: '2026-08-03',
          durationSeconds: 2 * 3600,
          // `remoteTimeLogSchema` declares these `.nullable()` but not
          // `.optional()`: an absent key (not even `null`) fails validation,
          // which the bridge then drops silently — leaving the pending
          // operation to hang until the 130s page deadline rather than
          // resolving or rejecting quickly.
          activityId: null,
          activityName: null,
          comment,
          remoteUserId: null,
          remoteProjectId: '12',
          remoteProjectTitle: 'CMPL Web',
        },
      ],
    });
    await seedBrowserSecret(page, tracker.id);
    await fillLogin(page, user.email, user.password, { height: 900 });

    await page.click('[data-testid="app-sidebar"] a[href="/trackers"]');
    await page.waitForSelector('[data-testid="trackers-page"]');
    await page.click(`[data-testid="import-tracker-${tracker.id}"]`);
    await page.waitForSelector('[data-testid="tracker-import-dialog"]');
    await page.fill('[data-testid="tracker-import-from-input"]', '2026-08-01');
    await page.fill('[data-testid="tracker-import-to-input"]', '2026-08-31');
    await page.click('[data-testid="tracker-import-scan"]');

    // TEMP DEBUG — remove before merge
    try {
      await page.waitForSelector('[data-testid="tracker-import-preview"]', { timeout: 10000 });
    } catch (err) {
      const installed = await page.evaluate(() => Boolean(window.__osiFakeExtension));
      const state = await readFakeExtensionState(page);
      const phaseEl = await page
        .locator('[data-testid="tracker-import-dialog"]')
        .getAttribute('data-testid')
        .catch(() => null);
      const bodyText = await page.locator('body').innerText();
      // SAFETY: this catch only runs after page.waitForSelector, which always rejects with an Error.
      const originalMessage = (err as Error).message;
      throw new Error(
        `DBG: extensionInstalled=${installed} state=${JSON.stringify(state)} phaseElExists=${phaseEl} bodyText=${bodyText.slice(0, 500)} original=${originalMessage}`,
        { cause: err },
      );
    }
    const previewText = await page.textContent('[data-testid="tracker-import-preview"]');
    expect(previewText).toContain(project.name);

    await page.click('[data-testid="tracker-import-confirm"]');
    await page.waitForSelector('[data-testid="tracker-import-done"]');
    expect(await page.textContent('[data-testid="tracker-import-done-imported"]')).toBe('1');
    await page.click('[data-testid="tracker-import-close"]');

    await page.click('[data-testid="app-sidebar"] a[href="/"]');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, comment);

    await page.close();
  });
});
