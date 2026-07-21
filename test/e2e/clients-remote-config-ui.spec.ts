import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeRemoteConfigUI = requireBrowser();

describeRemoteConfigUI('client remote config UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'remoteconfigui@example.com', displayName: 'remoteconfiguiuser' },
  ]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  it('5.4 creates, edits, and removes a remote config through the form; secret never sent; survives reload', async () => {
    const page = await loginAs('remoteconfigui@example.com');
    await page.click('[data-testid="app-sidebar"] [data-testid="nav-link-clients"]');
    await page.waitForSelector('[data-testid="clients-page"]');

    // Create a client to attach the remote config to
    const clientName = 'Remote Config Client ' + Date.now();
    await page.click('[data-testid="new-client-button"]');
    await page.waitForSelector('[data-testid="client-dialog"]');
    await page
      .locator('[data-testid="client-name-input"] input, [data-testid="client-name-input"]')
      .first()
      .fill(clientName);
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="client-dialog"]', { state: 'hidden' });
    await page.waitForFunction((name) => document.body.textContent?.includes(name), clientName);

    // Open the edit dialog and fill in the remote config
    const row = page.locator('tr', { hasText: clientName });
    await row.locator('[data-testid^="edit-client-"]').click();
    await page.waitForSelector('[data-testid="client-dialog"]');
    // Wait until the async config fetch settles so the form is mounted once with defaults.
    await page.waitForSelector('[data-testid="remote-config-form"]');

    // Capture outgoing PUT bodies to ensure the secret is never sent
    const sentBodies: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/remote-config') && request.method() === 'PUT') {
        const data = request.postData();
        if (data) sentBodies.push(data);
      }
    });

    await page
      .locator(
        '[data-testid="remote-config-base-url-input"] input, [data-testid="remote-config-base-url-input"]',
      )
      .first()
      .fill('https://redmine.example.com');
    await page
      .locator(
        '[data-testid="remote-config-secret-input"] input, [data-testid="remote-config-secret-input"]',
      )
      .first()
      .fill('super-secret-api-key');

    // Pick a non-default system type (default is OpenProject) so reopening the
    // dialog must reflect the *saved* value rather than the default. This guards
    // the edit-dialog reactivity bug where the Form snapshotted stale defaults.
    await page.click('[data-testid="remote-config-system-type-select"]');
    await page.getByRole('option', { name: 'Redmine' }).click();

    await page.click('[data-testid="remote-config-save-button"]');
    await page.waitForSelector('[data-testid="remote-config-remove-button"]');

    expect(sentBodies.length).toBeGreaterThan(0);
    for (const body of sentBodies) {
      expect(body).not.toContain('super-secret-api-key');
    }

    // Close and reopen the dialog: config and secret survive reload
    await page.click('[data-testid="cancel-button"]');
    await page.waitForSelector('[data-testid="client-dialog"]', { state: 'hidden' });
    await row.locator('[data-testid^="edit-client-"]').click();
    await page.waitForSelector('[data-testid="remote-config-remove-button"]');
    const savedSystemType = await page
      .locator('[data-testid="remote-config-system-type-select"]')
      .textContent();
    expect(savedSystemType).toContain('Redmine');
    expect(await page.inputValue('[data-testid="remote-config-base-url-input"]')).toBe(
      'https://redmine.example.com',
    );
    expect(await page.inputValue('[data-testid="remote-config-secret-input"]')).toBe(
      'super-secret-api-key',
    );

    // Remove the remote config
    await page.click('[data-testid="remote-config-remove-button"]');
    await page.getByRole('button', { name: /yes/i }).click();
    await page.waitForSelector('[data-testid="remote-config-remove-button"]', { state: 'hidden' });

    // Reopen: config is gone
    await page.click('[data-testid="cancel-button"]');
    await page.waitForSelector('[data-testid="client-dialog"]', { state: 'hidden' });
    await row.locator('[data-testid^="edit-client-"]').click();
    await page.waitForSelector('[data-testid="client-dialog"]');
    expect(await page.locator('[data-testid="remote-config-remove-button"]').count()).toBe(0);
  });
});
