import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';

const describeNavigationLoading = requireBrowser();

/**
 * Client navigation never waits for page data (REQ-391): with the destination's
 * request held back, the page is already on screen with its loading state.
 */
describeNavigationLoading('client navigation with slow page data', async () => {
  const dbUrl = await provisionDatabase();
  const user = await seedUser(dbUrl, { displayName: 'navloading' });
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function openProjects() {
    const page = await createPage('/');
    await fillLogin(page, user.email, user.password);
    await page.goto(url('/projects'), { waitUntil: 'hydration' });
    await page.waitForSelector('[data-testid="projects-page"]');
    return page;
  }

  type BrowserPage = Awaited<ReturnType<typeof openProjects>>;

  /** Holds every request matching `pattern` until the returned release is called. */
  async function holdRequests(page: BrowserPage, pattern: string) {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(pattern, async (route) => {
      await gate;
      await route.continue();
    });
    return release;
  }

  it('shows the timer view skeleton before the feed answers', async () => {
    const page = await openProjects();
    const release = await holdRequests(page, '**/api/time-entries/feed**');

    await page.click('[data-testid="app-sidebar"] a[href="/"]');
    await page.waitForSelector('[data-testid="timer-view-loading"]');
    expect(await page.locator('[data-testid="timer-view-never-tracked"]').count()).toBe(0);

    release();
    await page.waitForSelector('[data-testid="timer-view-never-tracked"]');
    expect(await page.locator('[data-testid="timer-view-loading"]').count()).toBe(0);
    await page.close();
  });

  it('shows the monthly report page before the report answers', async () => {
    const page = await openProjects();
    const release = await holdRequests(page, '**/api/reports/monthly**');

    await page.click('[data-testid="app-sidebar"] a[href="/reports/monthly"]');
    await page.waitForSelector('[data-testid="reports-monthly"]');
    await page.waitForSelector('[data-testid="reports-monthly-table"]');
    expect(await page.locator('[data-testid="reports-monthly-empty"]').count()).toBe(0);

    release();
    await page.waitForSelector('[data-testid="reports-monthly-empty"]');
    await page.close();
  });
});
