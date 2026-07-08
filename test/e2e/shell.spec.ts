import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeShell = requireBrowser();

describeShell('authenticated shell navigation', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'shell@example.com', displayName: 'shelluser' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    await page.waitForSelector('[data-testid="app-sidebar"]');
    return page;
  }

  it('shell renders top bar and sidebar after login', async () => {
    const page = await loginAs('shell@example.com');
    expect(await page.locator('[data-testid="app-topbar"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="app-sidebar"]').isVisible()).toBe(true);
  });

  it('sidebar lists all skeleton destinations', async () => {
    const page = await loginAs('shell@example.com');
    const nav = page.locator('[data-testid="app-sidebar"]');
    expect(await nav.locator('a[href="/"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/clients"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/projects"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/tasks"]').count()).toBe(0);
    expect(await nav.locator('a[href="/reports"]').isVisible()).toBe(true);
    expect(await nav.locator('a[href="/settings"]').isVisible()).toBe(true);
  });

  it('navigating to an unbuilt destination shows a placeholder page', async () => {
    const page = await loginAs('shell@example.com');
    await page.click('[data-testid="app-sidebar"] a[href="/reports"]');
    await page.waitForSelector('[data-testid="placeholder-page-reports"]');
    expect(await page.locator('[data-testid="placeholder-page-reports"]').isVisible()).toBe(true);
  });

  it('logout is reachable via the utility menu', async () => {
    const page = await loginAs('shell@example.com');
    await page.click('[data-testid="utility-menu-button"]');
    await page
      .getByRole('menuitem', { name: /log.?out/i })
      .first()
      .click();
    await page.waitForSelector('[data-testid="login-form"]');
  });
});
