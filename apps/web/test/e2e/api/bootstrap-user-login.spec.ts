import postgres from 'postgres';
import { beforeEach, expect, it } from 'vitest';
import { readBootstrapUser, seedBootstrapUser } from '@osi/migrator';
import { url } from '../helpers/url';
import { CookieJar, primeCsrf } from '../helpers/auth';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { E2E_LOGIN_RATE_LIMIT } from '../../../shared/config/rate-limit';

const describeBootstrap = requireDocker();

/** Seeds through the migrator exactly as the migrate step does from `BOOTSTRAP_USER_*`. */
async function seed(dbUrl: string, email: string, password: string): Promise<void> {
  const user = readBootstrapUser({
    BOOTSTRAP_USER_EMAIL: email,
    BOOTSTRAP_USER_PASSWORD: password,
  });
  expect(user).toBeDefined();
  const sql = postgres(dbUrl, { max: 1 });
  try {
    await seedBootstrapUser(sql, user!);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function login(email: string, password: string): Promise<{ res: Response; jar: CookieJar }> {
  const jar = new CookieJar();
  const token = await primeCsrf(jar);
  const res = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ email, password }),
  });
  jar.capture(res);
  return { res, jar };
}

// core-authentication REQ-012: the migrator hashes the bootstrap password outside Nuxt,
// so this pins that the app's own login verification accepts what the migrator stores.
describeBootstrap('bootstrap user login', async () => {
  const dbUrl = await provisionDatabase();
  await seed(dbUrl, ' Bootstrap.Admin@Example.com ', 'bootstrap-secret');
  await setupServer({ databaseUrl: dbUrl });

  beforeEach(async () => {
    // Let the login rate limiter replenish between requests.
    await new Promise((resolve) => setTimeout(resolve, E2E_LOGIN_RATE_LIMIT.interval));
  });

  it('logs in with the seeded credentials, whatever the email letter case', async () => {
    const { res, jar } = await login('BOOTSTRAP.admin@example.COM', 'bootstrap-secret');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      loggedIn: true,
      user: { email: 'bootstrap.admin@example.com' },
    });
    expect(jar.has('nuxt-session')).toBe(true);
  });

  it('rejects a wrong password with the standard credentials error', async () => {
    const { res, jar } = await login('bootstrap.admin@example.com', 'not-the-password');

    expect(res.status).toBe(401);
    expect((await res.json())?.data?.messageKey).toBe('errors.auth.invalidCredentials');
    expect(jar.has('nuxt-session')).toBe(false);
  });

  it('keeps the original password when seeding runs again with a different one', async () => {
    await seed(dbUrl, 'bootstrap.admin@example.com', 'a-different-secret');

    const { res: original } = await login('bootstrap.admin@example.com', 'bootstrap-secret');
    expect(original.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, E2E_LOGIN_RATE_LIMIT.interval));
    const { res: replaced } = await login('bootstrap.admin@example.com', 'a-different-secret');
    expect(replaced.status).toBe(401);
  });
});
