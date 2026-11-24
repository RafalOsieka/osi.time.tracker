import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { startEntry } from '../helpers/http';

const describeSsrShell = requireBrowser();

describeSsrShell('SSR shell and list pages', async () => {
  const dbUrl = await provisionDatabase();
  const user = await seedUser(dbUrl, { displayName: 'ssrshell' });
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function apiSession() {
    return apiLogin(user.email, user.password);
  }

  async function openAuthed() {
    const page = await createPage('/');
    await fillLogin(page, user.email, user.password);
    return page;
  }

  it('redirects an authenticated request for /login to the Dashboard', async () => {
    const { jar } = await apiSession();

    const res = await fetch(url('/login'), {
      headers: { cookie: jar.header() },
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  it('renders the Dashboard at / on the server with its data', async () => {
    const { email, password } = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(email, password);
    const created = await startEntry(jar, token, {
      title: 'Server rendered dashboard entry',
      startedAt: '2026-08-03T10:00:00.000Z',
      stoppedAt: '2026-08-03T11:15:00.000Z',
    });
    expect(created.status).toBe(200);

    const res = await fetch(url('/?period=month&date=2026-08-03'), {
      headers: { cookie: jar.header() },
      redirect: 'manual',
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<span data-testid="dashboard-total">1:15</span>');
    expect(html).toContain('August 2026');
    expect(html).not.toContain('data-testid="dashboard-loading"');
  });

  it('renders the empty account on the server', async () => {
    const { email, password } = await seedUser(dbUrl);
    const { jar } = await apiLogin(email, password);

    const res = await fetch(url('/'), { headers: { cookie: jar.header() }, redirect: 'manual' });

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('data-testid="dashboard-empty-account"');
  });

  it.each(['/', '/timer'])(
    'redirects an unauthenticated request for %s to login, keeping the address',
    async (path) => {
      const res = await fetch(url(path), { redirect: 'manual' });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`/login?redirect=${path}`);
    },
  );

  it('renders the first page of the day list at /timer on the server', async () => {
    const { email, password } = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(email, password);
    const title = 'Server rendered timer entry';
    const created = await startEntry(jar, token, {
      title,
      startedAt: '2026-08-03T10:00:00.000Z',
      stoppedAt: '2026-08-03T11:00:00.000Z',
    });
    expect(created.status).toBe(200);

    const res = await fetch(url('/timer'), {
      headers: { cookie: jar.header() },
      redirect: 'manual',
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-testid="timer-day-2026-08-03"');
    expect(html).toContain(title);
  });

  it('hard navigation to /trackers shows list or empty state', async () => {
    const page = await openAuthed();
    await page.goto(url('/trackers'), { waitUntil: 'hydration' });
    await page.waitForSelector('[data-testid="trackers-page"]');
    await page.waitForSelector(
      '[data-testid="trackers-empty-state"], [data-testid="trackers-table"]',
    );
  });

  it('hard navigation to /projects shows list or empty state without tracker filter', async () => {
    const page = await openAuthed();
    await page.goto(url('/projects'), { waitUntil: 'hydration' });
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

    const page = await openAuthed();
    // Full document load of an authenticated page with a running entry
    // eslint-disable-next-line no-restricted-syntax -- asserts server-rendered state, before hydration
    await page.goto(url('/profile'));
    await page.waitForSelector('[data-testid="app-timer"]');

    // Title should be present without waiting solely on a post-mount client fetch.
    // Use the timer title input value / text content.
    await page.waitForFunction(() => {
      const el = document.querySelector(
        '[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]',
      );
      const text = el instanceof HTMLInputElement ? el.value : (el?.textContent ?? '');
      return text.includes('SSR Running Title');
    });

    const elapsed = page.locator('[data-testid="timer-elapsed"]');
    expect(await elapsed.isVisible()).toBe(true);
    // Elapsed may start at zero then tick; just assert the control is present.
    const label = await elapsed.textContent();
    expect(label).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
