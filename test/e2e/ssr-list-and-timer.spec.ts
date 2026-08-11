import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeSsrShell = requireBrowser();

describeSsrShell('SSR shell and list pages', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'ssrshell@example.com', displayName: 'ssrshell' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function apiSession() {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const loginRes = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'ssrshell@example.com', password: 'secret' }),
    });
    jar.capture(loginRes);
    return { jar, token };
  }

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  it('hard navigation to /trackers shows list or empty state', async () => {
    const page = await loginAs('ssrshell@example.com');
    await page.goto(url('/trackers'));
    await page.waitForSelector('[data-testid="trackers-page"]');
    await page.waitForSelector(
      '[data-testid="trackers-empty-state"], [data-testid="trackers-table"]',
    );
  });

  it('hard navigation to /projects shows list or empty state without tracker filter', async () => {
    const page = await loginAs('ssrshell@example.com');
    await page.goto(url('/projects'));
    await page.waitForSelector('[data-testid="projects-page"]');
    await page.waitForSelector(
      '[data-testid="projects-empty-state"], [data-testid="projects-table"]',
    );
    expect(await page.locator('[data-testid="project-tracker-filter"]').count()).toBe(0);

    await page.click('[data-testid="new-project-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]');
    expect(await page.locator('[data-testid="project-tracker-select"]').count()).toBe(1);
  });

  it('hard navigation with a running entry shows the running title in AppTimer', async () => {
    const { jar, token } = await apiSession();
    const startRes = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ title: 'SSR Running Title' }),
    });
    expect(startRes.status).toBe(200);

    const page = await loginAs('ssrshell@example.com');
    // Full document load of an authenticated page with a running entry
    await page.goto(url('/settings'));
    await page.waitForSelector('[data-testid="app-timer"]');

    // Title should be present without waiting solely on a post-mount client fetch.
    // Use the timer title input value / text content.
    await page.waitForFunction(() => {
      const input = document.querySelector(
        '[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]',
      ) as HTMLInputElement | null;
      const text = input?.value ?? input?.textContent ?? '';
      return text.includes('SSR Running Title');
    });

    const elapsed = page.locator('[data-testid="timer-elapsed"]');
    expect(await elapsed.isVisible()).toBe(true);
    // Elapsed may start at zero then tick; just assert the control is present.
    const label = await elapsed.textContent();
    expect(label).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
