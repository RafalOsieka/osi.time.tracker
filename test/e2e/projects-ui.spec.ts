import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeProjectsUI = requireBrowser();

describeProjectsUI('projects UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'projectsui@example.com', displayName: 'projectsuiuser' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  /** Create a client via the API, used to seed data ahead of UI-driven project CRUD. */
  async function createClientViaApi(name: string): Promise<{ id: string; name: string }> {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const loginRes = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'projectsui@example.com', password: 'secret' }),
    });
    jar.capture(loginRes);
    const res = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name }),
    });
    return res.json();
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

  it('4.8 full CRUD happy path through the UI and filtering by client', async () => {
    const clientA = await createClientViaApi('UI Client A ' + Date.now());
    const clientB = await createClientViaApi('UI Client B ' + Date.now());

    const page = await loginAs('projectsui@example.com');
    await page.click('[data-testid="app-sidebar"] [data-testid="nav-link-projects"]');
    await page.waitForSelector('[data-testid="projects-page"]');

    // Create a project under Client A
    await page.click('[data-testid="new-project-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('UI Project One');
    await page.click('[data-testid="project-client-select"]');
    await page.getByRole('option', { name: clientA.name }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]', { state: 'hidden' });

    await page.waitForFunction(() => document.body.textContent?.includes('UI Project One'));
    expect(await page.textContent('[data-testid="projects-table"]')).toContain('UI Project One');

    // Filter by Client B: the project (under Client A) should disappear
    await page.click('[data-testid="project-client-filter"]');
    await page.getByRole('option', { name: clientB.name }).click();
    await page.waitForFunction(() => !document.body.textContent?.includes('UI Project One'));
    expect(await page.textContent('[data-testid="projects-table"]')).not.toContain(
      'UI Project One',
    );

    // Clear the filter by selecting Client A so the project is visible again
    await page.click('[data-testid="project-client-filter"]');
    await page.getByRole('option', { name: clientA.name }).click();
    await page.waitForFunction(() => document.body.textContent?.includes('UI Project One'));

    // Edit the project
    const row = page.locator('tr', { hasText: 'UI Project One' });
    await row.locator('[data-testid^="edit-project-"]').click();
    await page.waitForSelector('[data-testid="project-dialog"]');
    await page
      .locator('[data-testid="project-name-input"] input, [data-testid="project-name-input"]')
      .first()
      .fill('UI Project Renamed');
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="project-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('UI Project Renamed'));

    // Delete the project
    const renamedRow = page.locator('tr', { hasText: 'UI Project Renamed' });
    await renamedRow.locator('[data-testid^="delete-project-"]').click();
    await page.locator('[data-testid="confirm-accept"]').click();
    await page.waitForFunction(() => !document.body.textContent?.includes('UI Project Renamed'));
    expect(await page.textContent('[data-testid="projects-table"]')).not.toContain(
      'UI Project Renamed',
    );
  });
});
