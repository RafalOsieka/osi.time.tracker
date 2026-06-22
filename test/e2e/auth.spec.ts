import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { setup, url } from '@nuxt/test-utils/e2e';
import { sql as drizzleSql } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { CookieJar, primeCsrf } from './support/auth';
import { createDatabaseClient } from '../../server/db/client';
import { runMigrations } from '../../server/db/migrate';
import { users } from '../../server/db/schema/users';
import {
  TEST_DATABASE_URL,
  isDockerAvailable,
  startPostgres,
  stopPostgres,
} from './support/postgres';

// Set DATABASE_URL for Nitro and tests to pick up
process.env.DATABASE_URL = TEST_DATABASE_URL;

const SESSION_PASSWORD = 'test-session-password-0123456789-abcdef';
const dockerAvailable = isDockerAvailable();
const describeAuth = dockerAvailable ? describe : describe.skip;

if (!dockerAvailable) {
  // eslint-disable-next-line no-console
  console.warn('[auth.spec] Docker not available — skipping Auth E2E integration tests.');
}

describeAuth('authentication integration', async () => {
  await setup({
    nuxtConfig: {
      runtimeConfig: {
        session: { password: SESSION_PASSWORD },
      },
    },
  });

  beforeAll(async () => {
    await startPostgres();
    await runMigrations(TEST_DATABASE_URL);

    // Resolve hasher and insert test user
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
        displayName: 'Alice Liddell',
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 180_000);

  afterAll(() => {
    stopPostgres();
  });

  it('3.1 login sets a session cookie (happy path) and rejects invalid input', async () => {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);

    // Happy path: valid credentials establish a session.
    const ok = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({ email: 'alice@example.com', password: 'secret' }),
    });
    jar.capture(ok);
    expect(ok.status).toBe(200);
    const resData = await ok.json();
    expect(resData).toMatchObject({
      loggedIn: true,
      user: { email: 'alice@example.com', displayName: 'Alice Liddell' },
    });
    expect(resData.user.id).toBeDefined();
    expect(jar.has('nuxt-session')).toBe(true);

    // Case-insensitive email match
    const caseJar = new CookieJar();
    const caseToken = await primeCsrf(caseJar);
    const caseOk = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': caseToken,
        cookie: caseJar.header(),
      },
      body: JSON.stringify({ email: 'ALICE@example.com', password: 'secret' }),
    });
    expect(caseOk.status).toBe(200);
    expect(await caseOk.json()).toMatchObject({
      loggedIn: true,
      user: { email: 'alice@example.com' },
    });

    // Error path: wrong password is rejected with a 401
    const wrongPassJar = new CookieJar();
    const wrongPassToken = await primeCsrf(wrongPassJar);
    const wrongPass = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': wrongPassToken,
        cookie: wrongPassJar.header(),
      },
      body: JSON.stringify({ email: 'alice@example.com', password: 'wrongpassword' }),
    });
    expect(wrongPass.status).toBe(401);

    // Error path: unknown email is rejected indistinguishably with a 401
    const unknownJar = new CookieJar();
    const unknownToken = await primeCsrf(unknownJar);
    const unknown = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': unknownToken,
        cookie: unknownJar.header(),
      },
      body: JSON.stringify({ email: 'unknown@example.com', password: 'secret' }),
    });
    expect(unknown.status).toBe(401);

    // Error path: missing password is rejected with a 400.
    const jar2 = new CookieJar();
    const token2 = await primeCsrf(jar2);
    const bad = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token2,
        cookie: jar2.header(),
      },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(bad.status).toBe(400);
  });

  it('3.2 logout clears the session; subsequent request is unauthenticated', async () => {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);

    const login = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'alice@example.com', password: 'secret' }),
    });
    jar.capture(login);

    const before = await fetch(url('/api/auth/session'), { headers: { cookie: jar.header() } });
    expect(await before.json()).toMatchObject({ loggedIn: true });

    const logout = await fetch(url('/api/auth/logout'), {
      method: 'POST',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    jar.capture(logout);
    expect(logout.status).toBe(200);

    const after = await fetch(url('/api/auth/session'), { headers: { cookie: jar.header() } });
    expect(await after.json()).toMatchObject({ loggedIn: false });
  });

  it('3.3 protected endpoint returns 401 without a session and succeeds with one', async () => {
    const unauth = await fetch(url('/api/protected'));
    expect(unauth.status).toBe(401);

    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const login = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'alice@example.com', password: 'secret' }),
    });
    jar.capture(login);

    const ok = await fetch(url('/api/protected'), { headers: { cookie: jar.header() } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ user: { email: 'alice@example.com' } });
  });

  it('3.4 mutating request without a valid CSRF token is rejected; with a token it succeeds', async () => {
    // No CSRF token / secret -> rejected.
    const noToken = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'secret' }),
    });
    expect(noToken.status).toBe(403);

    // Valid CSRF token + secret -> accepted.
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const withToken = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'alice@example.com', password: 'secret' }),
    });
    expect(withToken.status).toBe(200);
  });

  it('5.2 excessive login attempts are throttled while normal usage is unaffected', async () => {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);

    // Make 5 successful / failed requests - the rate limiter should allow them
    for (let i = 0; i < 5; i++) {
      const res = await fetch(url('/api/auth/login'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'csrf-token': token,
          cookie: jar.header(),
        },
        body: JSON.stringify({ email: 'alice@example.com', password: 'wrongpassword' }),
      });
      expect(res.status).toBe(401);
    }

    // The 6th attempt should be rejected with 429
    const throttled = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({ email: 'alice@example.com', password: 'wrongpassword' }),
    });
    expect(throttled.status).toBe(429);
  });

  it('3.5 responses include baseline security headers (incl. CSP)', async () => {
    const res = await fetch(url('/'));
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
