import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUsers } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';

const describeAuthUI = requireBrowser();

describeAuthUI('authentication UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'alice' },
    { email: 'bob@example.com', displayName: 'bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('login heading shows the brand mark beside the application title', async () => {
    const page = await createPage('/login');
    await page.waitForSelector('[data-testid="login-form"]');
    const heading = page.getByRole('heading', { name: 'OSI Time Tracker' });
    expect(await heading.isVisible()).toBe(true);
    expect(await heading.locator('[data-testid="app-brand-mark"]').isVisible()).toBe(true);
    expect(await page.title()).toBe('Log in | OSI Time Tracker');
  });

  it('5.1 login flow logs the user in and the UI reflects it', async () => {
    const page = await createPage('/');
    await fillLogin(page, 'alice@example.com');

    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForSelector('[data-testid="app-user-footer"]');
    expect(new URL(page.url()).pathname).toBe('/timer');
    expect(await page.title()).toBe('Timer | OSI Time Tracker');
    const primary = await page.textContent('[data-testid="app-user-footer-primary"]');
    expect(primary?.trim()).toBe('alice');
    const email = await page.textContent('[data-testid="app-user-footer-email"]');
    expect(email?.trim()).toBe('alice@example.com');
  });

  it('returns a visitor of /timer there after login', async () => {
    const page = await createPage('/timer');
    expect(new URL(page.url()).pathname).toBe('/login');
    await fillLogin(page, 'alice@example.com');

    await page.waitForSelector('[data-testid="timer-view-page"]');
    expect(new URL(page.url()).pathname).toBe('/timer');
    await page.close();
  });

  it('ends on the Timer view after a login without a requested address', async () => {
    const page = await createPage('/login');
    await fillLogin(page, 'alice@example.com');

    await page.waitForSelector('[data-testid="timer-view-page"]');
    expect(new URL(page.url()).pathname).toBe('/timer');
    await page.close();
  });

  it('5.2 logout flow logs the user out and the UI reflects it', async () => {
    const page = await createPage('/');
    await fillLogin(page, 'bob@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    await page.click('[data-testid="app-user-footer-trigger"]');
    await page
      .getByRole('menuitem', { name: /log.?out/i })
      .first()
      .click();
    await page.waitForSelector('[data-testid="login-form"]');
    expect(page.url()).toContain('/login');
  });
});
