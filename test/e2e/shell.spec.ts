import { existsSync } from 'node:fs';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createPage, setup } from '@nuxt/test-utils/e2e';
import { chromium } from 'playwright-core';
import { sql as drizzleSql } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { createDatabaseClient } from '../../server/db/client';
import { runMigrations } from '../../server/db/migrate';
import { users } from '../../server/db/schema/users';
import { TEST_DATABASE_URL, startPostgres, stopPostgres } from './support/postgres';

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
  // eslint-disable-next-line no-console
  console.warn('[shell.spec] No browser available — skipping shell e2e tests.');
  describe.skip('authenticated shell navigation (browser unavailable)', () => {
    it('skipped', () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('authenticated shell navigation', async () => {
    await setup({
      browser: true,
      nuxtConfig: { runtimeConfig: { session: { password: SESSION_PASSWORD } } },
    });

    beforeAll(async () => {
      await startPostgres();
      await runMigrations(TEST_DATABASE_URL);

      const requireModule = createRequire(import.meta.resolve('nuxt-auth-utils'));
      const hashMjsPath = 'file:///' + requireModule.resolve('@adonisjs/hash').replace(/\\/g, '/');
      const scryptMjsPath =
        'file:///' + requireModule.resolve('@adonisjs/hash/drivers/scrypt').replace(/\\/g, '/');
      const { Hash } = await import(hashMjsPath);
      const { Scrypt } = await import(scryptMjsPath);
      const hasher = new Hash(new Scrypt({}));
      const passwordHash = await hasher.make('secret');

      const { db, sql } = createDatabaseClient(TEST_DATABASE_URL);
      try {
        await db.execute(drizzleSql`TRUNCATE TABLE users CASCADE`);
        await db.insert(users).values({
          email: 'shell@example.com',
          passwordHash,
          displayName: 'shelluser',
        });
      } finally {
        await sql.end({ timeout: 5 });
      }
    }, 180_000);

    afterAll(() => {
      stopPostgres();
    });

    async function loginAs(email: string) {
      const page = await createPage('/');
      await page.fill('[data-testid="email"]', email);
      await page.fill('[data-testid="password"] input', 'secret');
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="app-topbar"]');
      return page;
    }

    it('shell renders top bar and sidebar after login', async () => {
      const page = await loginAs('shell@example.com');
      expect(await page.locator('[data-testid="app-topbar"]').isVisible()).toBe(true);
      expect(await page.locator('nav[aria-label]').isVisible()).toBe(true);
    });

    it('sidebar lists all skeleton destinations', async () => {
      const page = await loginAs('shell@example.com');
      const nav = page.locator('nav[aria-label]');
      await expect(nav.locator('a[href="/"]')).toBeVisible();
      await expect(nav.locator('a[href="/clients"]')).toBeVisible();
      await expect(nav.locator('a[href="/projects"]')).toBeVisible();
      await expect(nav.locator('a[href="/tasks"]')).toBeVisible();
      await expect(nav.locator('a[href="/reports"]')).toBeVisible();
      await expect(nav.locator('a[href="/settings"]')).toBeVisible();
    });

    it('navigating to an unbuilt destination shows a placeholder page', async () => {
      const page = await loginAs('shell@example.com');
      await page.click('nav[aria-label] a[href="/clients"]');
      await page.waitForSelector('[data-testid="placeholder-page-clients"]');
      expect(await page.locator('[data-testid="placeholder-page-clients"]').isVisible()).toBe(true);
    });

    it('logout is reachable via the utility menu', async () => {
      const page = await loginAs('shell@example.com');
      await page.click('[data-testid="utility-menu-button"]');
      await page.getByRole('menuitem', { name: /log.?out/i }).click();
      await page.waitForSelector('[data-testid="login-form"]');
    });
  });
}
