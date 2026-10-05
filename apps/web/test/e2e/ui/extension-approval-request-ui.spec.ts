import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { createTracker } from '../helpers/http';
import { seedUser } from '../helpers/seed';
import { loginAs, reloadHydrated } from '../helpers/ui';
import { installSuggestingExtension, installUnavailableExtension } from '../helpers/fake-extension';

const describeApprovalRequest = requireBrowser();

describeApprovalRequest('request tracker approval in the extension', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  /** A user with one tracker that must go through the extension, logged in on a fresh page. */
  async function loginWithExtensionTracker(install: (page: Page) => Promise<void>) {
    const user = await seedUser(dbUrl, { displayName: 'approval-request' });
    const { jar, token } = await apiLogin(user.email, user.password);
    const tracker = await createTracker(jar, token, `Needs Extension ${Date.now()}`, {
      systemType: 'redmine',
      baseUrl: 'https://rm.approval-request.example.com',
      directBrowserAccess: false,
    });
    const page = await createPage('/');
    await install(page);
    await loginAs(page, user.email, user.password);
    // Login navigates client-side; the stub's init script runs from the next document load.
    await reloadHydrated(page);
    await page.locator('[data-testid="extension-status-trigger"]').focus();
    await page.waitForSelector('[data-testid="extension-status-popover"]');
    return { page, tracker };
  }

  it('sends the tracker to the extension and says to finish the approval there', async () => {
    const { page, tracker } = await loginWithExtensionTracker(installSuggestingExtension);
    const request = page.locator(`[data-testid="extension-status-request-${tracker.id}"]`);
    await request.click();
    await page.waitForSelector(`[data-testid="extension-status-request-${tracker.id}-queued"]`);
    expect(await page.evaluate(() => window.__osiFakeSuggestions)).toEqual([
      { provider: 'redmine', baseUrl: 'https://rm.approval-request.example.com' },
    ]);
    await page.close();
  });

  it('offers no request while the extension is unavailable', async () => {
    const { page, tracker } = await loginWithExtensionTracker(installUnavailableExtension);
    await page.waitForSelector('[data-testid="extension-status-semantics"][data-state="red"]');
    expect(
      await page.locator(`[data-testid="extension-status-request-${tracker.id}"]`).count(),
    ).toBe(0);
    await page.close();
  });
});
