import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';

const describeShell = requireBrowser();

describeShell('authenticated shell navigation', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function openAuthed() {
    const user = await seedUser(dbUrl, { displayName: 'shelluser' });
    const page = await createPage('/');
    await loginAs(page, user.email, user.password);
    await page.waitForSelector('[data-testid="app-sidebar"]');
    return page;
  }

  it('sidebar brand shows the mark and the application title when expanded', async () => {
    const page = await openAuthed();
    const brand = page.locator('[data-testid="app-sidebar-brand"]');
    expect(await brand.locator('[data-testid="app-brand-mark"]').isVisible()).toBe(true);
    expect((await brand.textContent()) ?? '').toMatch(/OSI Time Tracker/);
  });

  it('shell renders top bar and sidebar after login', async () => {
    const page = await openAuthed();
    expect(await page.locator('[data-testid="app-topbar"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="app-sidebar"]').isVisible()).toBe(true);
  });

  it('sidebar lists all skeleton destinations', async () => {
    const page = await openAuthed();
    const nav = page.locator('[data-testid="app-sidebar"]');
    expect(await nav.locator('a[href="/"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/trackers"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/projects"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/tasks"]').count()).toBe(0);
    expect(await nav.locator('a[href="/reports"]').count()).toBe(0);
    expect(await nav.locator('a[href="/reports/monthly"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/settings"]').isVisible()).toBe(true);
  });

  it('navigating to Monthly opens the monthly timesheet', async () => {
    const page = await openAuthed();
    await page.click('[data-testid="app-sidebar"] a[href="/reports/monthly"]');
    await page.waitForSelector('[data-testid="reports-monthly"]');
    expect(await page.locator('[data-testid="reports-monthly"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="reports-hub"]').count()).toBe(0);
    const monthlyLink = page.locator('[data-testid="app-sidebar"] a[href="/reports/monthly"]');
    expect(await monthlyLink.getAttribute('aria-current')).toBe('page');
    expect(await page.locator('[data-testid="app-sidebar"] [aria-current="page"]').count()).toBe(1);
  });

  it('authenticated /reports is not found', async () => {
    const page = await openAuthed();
    const response = await page.goto(new URL('/reports', page.url()).href);
    expect(response?.status()).toBe(404);
    expect(await page.locator('[data-testid="reports-hub"]').count()).toBe(0);
    expect(await page.locator('[data-testid="reports-monthly"]').count()).toBe(0);
  });

  it('logout is reachable via the sidebar account menu', async () => {
    const page = await openAuthed();
    await page.waitForSelector('[data-testid="app-user-footer"]');
    expect(await page.locator('[data-testid="app-user-footer-primary"]').textContent()).toMatch(
      /shelluser/i,
    );
    await page.click('[data-testid="app-user-footer-trigger"]');
    await page
      .getByRole('menuitem', { name: /log.?out/i })
      .first()
      .click();
    await page.waitForSelector('[data-testid="login-form"]');
  });
});
