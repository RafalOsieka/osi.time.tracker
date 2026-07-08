import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeAuthUI = requireBrowser();

describeAuthUI('authentication UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'alice' },
    { email: 'bob@example.com', displayName: 'bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('5.1 login flow logs the user in and the UI reflects it', async () => {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.fill('[data-testid="email"]', 'alice@example.com');
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');

    await page.waitForSelector('[data-testid="timer-view-page"]');
    const avatarLabel = await page.textContent('[data-testid="utility-menu-button"]');
    expect(avatarLabel?.trim()).toBe('A');
  });

  it('5.2 logout flow logs the user out and the UI reflects it', async () => {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.fill('[data-testid="email"]', 'bob@example.com');
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    await page.click('[data-testid="utility-menu-button"]');
    await page
      .getByRole('menuitem', { name: /log.?out/i })
      .first()
      .click();
    await page.waitForSelector('[data-testid="login-form"]');
    expect(page.url()).toContain('/login');
  });
});
