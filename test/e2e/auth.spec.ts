import { describe, expect, it } from 'vitest';
import { setup, url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';

// A fixed, 32+ character sealing secret so nuxt-auth-utils can issue sessions
// during the test run (mirrors the production NUXT_SESSION_PASSWORD env var).
const SESSION_PASSWORD = 'test-session-password-0123456789-abcdef';

describe('authentication integration', async () => {
  await setup({
    nuxtConfig: {
      runtimeConfig: {
        session: { password: SESSION_PASSWORD },
      },
    },
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
      body: JSON.stringify({ username: 'alice', password: 'secret' }),
    });
    jar.capture(ok);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ loggedIn: true, user: { name: 'alice' } });
    expect(jar.has('nuxt-session')).toBe(true);

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
      body: JSON.stringify({ username: 'alice' }),
    });
    expect(bad.status).toBe(400);
  });

  it('3.2 logout clears the session; subsequent request is unauthenticated', async () => {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);

    const login = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ username: 'bob', password: 'secret' }),
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
      body: JSON.stringify({ username: 'carol', password: 'secret' }),
    });
    jar.capture(login);

    const ok = await fetch(url('/api/protected'), { headers: { cookie: jar.header() } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ user: { name: 'carol' } });
  });

  it('3.4 mutating request without a valid CSRF token is rejected; with a token it succeeds', async () => {
    // No CSRF token / secret -> rejected.
    const noToken = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'dave', password: 'secret' }),
    });
    expect(noToken.status).toBe(403);

    // Valid CSRF token + secret -> accepted.
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const withToken = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ username: 'dave', password: 'secret' }),
    });
    expect(withToken.status).toBe(200);
  });

  it('3.5 responses include baseline security headers (incl. CSP)', async () => {
    const res = await fetch(url('/'));
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
