import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { setupServer } from './support/setupServer';

const describeI18nLogin = requireBrowser();

describeI18nLogin('i18n login page locale rendering', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it.sequential('renders English labels by default (en locale)', async () => {
    const page = await createPage('/login');
    // Clear any locale cookie so default locale applies
    await page.context().clearCookies();
    await page.reload();

    await page.waitForSelector('[data-testid="login-form"]');
    const emailLabel = await page.textContent('label[for="email"]');
    const passwordLabel = await page.textContent('label[for="password"]');
    const loginButton = await page.textContent('[data-testid="login-button"]');

    expect(emailLabel?.trim()).toBe('Email');
    expect(passwordLabel?.trim()).toBe('Password');
    expect(loginButton?.trim()).toContain('Log in');
  });

  it.sequential('renders Polish labels when locale cookie is set to pl', async () => {
    const page = await createPage('/login');
    // Set the i18n locale cookie to Polish
    await page.context().addCookies([
      {
        name: 'i18n_locale',
        value: 'pl',
        url: page.url(),
        sameSite: 'Lax',
      },
    ]);
    await page.reload();

    await page.waitForSelector('[data-testid="login-form"]');
    const emailLabel = await page.textContent('label[for="email"]');
    const passwordLabel = await page.textContent('label[for="password"]');
    const loginButton = await page.textContent('[data-testid="login-button"]');

    expect(emailLabel?.trim()).toBe('E-mail');
    expect(passwordLabel?.trim()).toBe('Hasło');
    expect(loginButton?.trim()).toContain('Zaloguj się');
  });
});
