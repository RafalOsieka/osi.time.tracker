import { expect, it, beforeEach } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { E2E_LOGIN_RATE_LIMIT } from '../../shared/config/rate-limit';

const describeAuth = requireDocker();

describeAuth('authentication integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    {
      email: 'alice@example.com',
      displayName: 'Alice Liddell',
    },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  beforeEach(async () => {
    // Wait to let the rate limiter replenish tokens
    await new Promise((resolve) => setTimeout(resolve, E2E_LOGIN_RATE_LIMIT.interval));
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

    // Error path: wrong password is rejected with a 401 and returns a messageKey
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
    const wrongPassBody = await wrongPass.json();
    expect(wrongPassBody?.data?.messageKey).toBe('errors.auth.invalidCredentials');
    expect(JSON.stringify(wrongPassBody)).not.toMatch(/Invalid credentials/);

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
    const unknownBody = await unknown.json();
    expect(unknownBody?.data?.messageKey).toBe('errors.auth.invalidCredentials');

    // Error path: missing password is rejected with a 400 and returns a messageKey
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
    const badBody = await bad.json();
    expect(badBody?.data?.messageKey).toBe('errors.auth.credentialsRequired');
    expect(JSON.stringify(badBody)).not.toMatch(/Email and password are required/);
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

    // Make N successful / failed requests - the rate limiter should allow them
    for (let i = 0; i < E2E_LOGIN_RATE_LIMIT.tokensPerInterval; i++) {
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

    // The next attempt (beyond the bucket size) should be rejected with 429
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
