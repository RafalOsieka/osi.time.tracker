import { existsSync } from 'node:fs';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createPage, setup } from '@nuxt/test-utils/e2e';
import { chromium } from 'playwright-core';
import { TEST_DATABASE_URL, startPostgres, stopPostgres } from './support/postgres';

// Set DATABASE_URL for Nitro and tests to pick up
process.env.DATABASE_URL = TEST_DATABASE_URL;

function browserAvailable(): boolean {
  try {
    const path = chromium.executablePath();
    return Boolean(path) && existsSync(path);
  } catch {
    return false;
  }
}

const SESSION_PASSWORD = 'test-session-password-0123456789-abcdef';

if (!browserAvailable()) {
  describe.skip('i18n login page locale rendering (browser unavailable)', () => {
    it('skipped', () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('i18n login page locale rendering', async () => {
    await setup({
      browser: true,
      nuxtConfig: { runtimeConfig: { session: { password: SESSION_PASSWORD } } },
    });

    beforeAll(async () => {
      await startPostgres();
    }, 180_000);

    afterAll(() => {
      stopPostgres();
    });

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
          domain: 'localhost',
          path: '/',
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
}
