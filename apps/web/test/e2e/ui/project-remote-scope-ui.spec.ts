import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { createTracker } from '../helpers/http';
import { installLostCreateExtension, installUnavailableExtension } from '../helpers/fake-extension';

const describeProjectRemoteScopeUi = requireBrowser();

const REDMINE_BASE_URL = 'https://rm.project-remote-scope-ui.example.com';
const TRACKER_SECRET = 'e2e-scope-secret';

describeProjectRemoteScopeUi('project remote scope UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function seedBrowserSecret(page: Page, trackerId: string) {
    await page.evaluate(({ id, secret }) => window.localStorage.setItem(`rsc:${id}`, secret), {
      id: trackerId,
      secret: TRACKER_SECRET,
    });
  }

  function redmineProjectsPayload(items: { id: number; name: string; parent?: { id: number } }[]) {
    return { projects: items, total_count: items.length, offset: 0, limit: 100 };
  }

  /** Registers a route mock serving the Redmine project catalog. */
  async function mockRedmineProjects(
    page: Page,
    items: { id: number; name: string; parent?: { id: number } }[],
  ) {
    await page.route(`${REDMINE_BASE_URL}/projects.json**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(redmineProjectsPayload(items)),
      });
    });
  }

  async function openTrackerSelect(page: Page, trackerName: string) {
    await page.click('[data-testid="project-tracker-select"]');
    await page.getByRole('option', { name: trackerName }).click();
  }

  it('5.1 loads the remote project catalog, persists the selection, and re-shows it pre-selected on reopen; switching tracker clears it', async () => {
    const user = await seedUser(dbUrl, { displayName: 'scopeuidialog' });
    const { jar, token } = await apiLogin(user.email, user.password);
    const trackerA = await createTracker(jar, token, 'Scope Dialog Tracker A ' + Date.now(), {
      baseUrl: REDMINE_BASE_URL,
      systemType: 'redmine',
      directBrowserAccess: true,
    });
    const trackerB = await createTracker(jar, token, 'Scope Dialog Tracker B ' + Date.now(), {
      baseUrl: REDMINE_BASE_URL,
      systemType: 'redmine',
      directBrowserAccess: true,
    });

    const page = await createPage('/');
    await seedBrowserSecret(page, trackerA.id);
    await seedBrowserSecret(page, trackerB.id);
    await mockRedmineProjects(page, [
      { id: 3, name: 'Spike Root' },
      { id: 4, name: 'Spike Child', parent: { id: 3 } },
    ]);
    await fillLogin(page, user.email, user.password, { height: 900 });

    await page.click('[data-testid="app-sidebar"] a[href="/projects"]');
    await page.waitForSelector('[data-testid="projects-page"]');

    await page.click('[data-testid="new-project-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('Scope UI Project');
    await openTrackerSelect(page, trackerA.name);

    await page.waitForSelector('[data-testid="project-remote-project-select"]');
    await page.click('[data-testid="project-remote-project-select"]');
    await page.getByRole('option', { name: 'Spike Root' }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('Scope UI Project'));

    expect(await page.textContent('[data-testid="projects-table"]')).toContain('Spike Root');

    // Reopen edit: the remote project select should already show the saved selection.
    const row = page.locator('tr', { hasText: 'Scope UI Project' });
    await row.locator('[data-testid^="edit-project-"]').click();
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page.waitForSelector('[data-testid="project-remote-project-select"]');
    // USelect (like the existing tracker select) is a listbox trigger, not a
    // native <select>; the current selection is its own displayed text.
    expect(await page.textContent('[data-testid="project-remote-project-select"]')).toContain(
      'Spike Root',
    );

    // Deselecting via the explicit "whole tracker" item (USelect has no
    // built-in clear affordance in this Nuxt UI version) must be possible.
    await page.click('[data-testid="project-remote-project-select"]');
    await page.getByRole('option', { name: 'Whole tracker' }).click();
    expect(await page.textContent('[data-testid="project-remote-project-select"]')).not.toContain(
      'Spike Root',
    );
    await page.click('[data-testid="project-remote-project-select"]');
    await page.getByRole('option', { name: 'Spike Root' }).click();

    // Switching tracker clears the pending scope (REQ-327) — the select should
    // no longer display "Spike Root" once tracker B's catalog loads.
    await openTrackerSelect(page, trackerB.name);
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[data-testid="project-remote-project-select"]')
          ?.textContent?.includes('Spike Root'),
    );

    await page.click('[data-testid="cancel-button"]');
    await page.close();
  });

  it('5.3 disables the remote project control with an incompatibility hint when the extension lacks the catalog operation, and enables it when advertised', async () => {
    const user = await seedUser(dbUrl, { displayName: 'scopeuiextension' });
    const { jar, token } = await apiLogin(user.email, user.password);
    const tracker = await createTracker(jar, token, 'Scope Extension Tracker ' + Date.now(), {
      baseUrl: REDMINE_BASE_URL,
      systemType: 'redmine',
      directBrowserAccess: false,
    });

    async function loginWithExtension(install: (p: Page) => Promise<void>): Promise<Page> {
      const page = await createPage('/');
      await install(page);
      await fillLogin(page, user.email, user.password, { height: 900 });
      return page;
    }

    // installUnavailableExtension's handshake never resolves as available, so the
    // dialog's capability probe times out into the same "cannot browse" state as
    // an extension that simply predates the catalog operation.
    const unsupportedPage = await loginWithExtension(installUnavailableExtension);
    await unsupportedPage.click('[data-testid="app-sidebar"] a[href="/projects"]');
    await unsupportedPage.waitForSelector('[data-testid="projects-page"]');
    await unsupportedPage.click('[data-testid="new-project-button"]');
    await unsupportedPage.waitForSelector('[data-testid="project-dialog"]');
    await unsupportedPage
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('Scope Extension Project');
    await unsupportedPage.click('[data-testid="project-tracker-select"]');
    await unsupportedPage.getByRole('option', { name: tracker.name }).click();
    await unsupportedPage.waitForSelector('[data-testid="project-remote-project-hint"]');
    expect(
      await unsupportedPage.locator('[data-testid="project-remote-project-select"]').count(),
    ).toBe(0);
    await unsupportedPage.click('[data-testid="cancel-button"]');
    await unsupportedPage.close();

    // The lost-create fake extension advertises the full current operation set
    // (including listProjects, fabricated client-side rather than via a real
    // tracker request, so no route mock is needed here), so the select should
    // become enabled. A browser-held secret is still required in extension
    // mode (REQ-203/REQ-327): the extension only routes the request, it does
    // not supply the credential.
    const supportedPage = await loginWithExtension(installLostCreateExtension);
    await seedBrowserSecret(supportedPage, tracker.id);
    await supportedPage.click('[data-testid="app-sidebar"] a[href="/projects"]');
    await supportedPage.waitForSelector('[data-testid="projects-page"]');
    await supportedPage.click('[data-testid="new-project-button"]');
    await supportedPage.waitForSelector('[data-testid="project-dialog"]');
    await supportedPage
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('Scope Extension Project 2');
    await supportedPage.click('[data-testid="project-tracker-select"]');
    await supportedPage.getByRole('option', { name: tracker.name }).click();
    await supportedPage.waitForSelector('[data-testid="project-remote-project-select"]');
    await supportedPage.click('[data-testid="cancel-button"]');
    await supportedPage.close();
  });
});
