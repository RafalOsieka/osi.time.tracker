import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPage, setup } from '@nuxt/test-utils/e2e';
import { chromium } from 'playwright-core';

// Browser-driven flows need a real browser binary. playwright-core ships
// without browsers, so skip (rather than fail) when none is installed —
// mirroring the Docker-availability guard in `db.spec.ts`.
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
  // eslint-disable-next-line no-console
  console.warn('[auth-ui.spec] No browser available — skipping UI e2e tests.');
  describe.skip('authentication UI flow (browser unavailable)', () => {
    it('skipped', () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('authentication UI flow', async () => {
    await setup({
      browser: true,
      nuxtConfig: { runtimeConfig: { session: { password: SESSION_PASSWORD } } },
    });

    it('5.1 login flow logs the user in and the UI reflects it', async () => {
      const page = await createPage('/');
      await page.fill('[data-testid="username"]', 'alice');
      await page.fill('[data-testid="password"] input', 'secret');
      await page.click('[data-testid="login-button"]');

      await page.waitForSelector('[data-testid="logout-button"]');
      const status = await page.textContent('[data-testid="auth-status"]');
      expect(status).toContain('Logged in as alice');
    });

    it('5.2 logout flow logs the user out and the UI reflects it', async () => {
      const page = await createPage('/');
      await page.fill('[data-testid="username"]', 'bob');
      await page.fill('[data-testid="password"] input', 'secret');
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="logout-button"]');

      await page.click('[data-testid="logout-button"]');
      await page.waitForSelector('[data-testid="login-form"]');
      const status = await page.textContent('[data-testid="auth-status"]');
      expect(status).toContain('not logged in');
    });
  });
}
