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

// Set DATABASE_URL for Nitro and tests to pick up
process.env.DATABASE_URL = TEST_DATABASE_URL;

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

    beforeAll(async () => {
      await startPostgres();
      await runMigrations(TEST_DATABASE_URL);

      // Resolve hasher and insert test users for E2E UI tests
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
          email: 'alice@example.com',
          passwordHash,
          displayName: 'alice',
        });
        await db.insert(users).values({
          email: 'bob@example.com',
          passwordHash,
          displayName: 'bob',
        });
      } finally {
        await sql.end({ timeout: 5 });
      }
    }, 180_000);

    afterAll(() => {
      stopPostgres();
    });

    it('5.1 login flow logs the user in and the UI reflects it', async () => {
      const page = await createPage('/');
      await page.fill('[data-testid="email"]', 'alice@example.com');
      await page.fill('[data-testid="password"] input', 'secret');
      await page.click('[data-testid="login-button"]');

      await page.waitForSelector('[data-testid="logout-button"]');
      const status = await page.textContent('[data-testid="auth-status"]');
      expect(status).toContain('Logged in as alice');
    });

    it('5.2 logout flow logs the user out and the UI reflects it', async () => {
      const page = await createPage('/');
      await page.fill('[data-testid="email"]', 'bob@example.com');
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
