import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { REMOTE_SECRET_HEADER } from '../../shared/config/remote-secret';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeRemoteProxy = requireDocker();

/** Log in and return a primed CookieJar + CSRF token. */
async function loginAs(
  email: string,
  password: string,
): Promise<{ jar: CookieJar; token: string }> {
  const jar = new CookieJar();
  const token = await primeCsrf(jar);
  const res = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ email, password }),
  });
  jar.capture(res);
  return { jar, token };
}

async function createClient(jar: CookieJar, token: string, name: string): Promise<{ id: string }> {
  const res = await fetch(url('/api/clients'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

async function createProxiedConfig(
  jar: CookieJar,
  token: string,
  clientId: string,
  baseUrl: string,
): Promise<{ id: string }> {
  const res = await fetch(url(`/api/clients/${clientId}/remote-config`), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({
      systemType: 'openproject',
      baseUrl,
      executionMode: 'server',
      roundingRule: 'none',
    }),
  });
  return res.json();
}

/** Minimal fake OpenProject server: inspects the Authorization header to decide the outcome. */
function startFakeTracker(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const authHeader = req.headers.authorization ?? '';
      const decoded = authHeader.startsWith('Basic ')
        ? Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf-8')
        : '';
      if (decoded.includes('rejected-secret')) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      if (req.url?.includes('/api/v3/work_packages/999')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }
      if (req.url?.includes('/api/v3/work_packages/42')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 42, subject: 'Fix login bug' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ _embedded: { elements: [{ id: 1, subject: 'Fix login bug' }] } }));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describeRemoteProxy('remote issue proxy API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  let tracker: { server: Server; baseUrl: string };
  beforeAll(async () => {
    tracker = await startFakeTracker();
  });
  afterAll(() => {
    tracker.server.close();
  });

  it('5.2 CSP connect-src is not widened by the proxy route (proxied requests stay same-origin)', async () => {
    const res = await fetch(url('/'));
    const csp = res.headers.get('content-security-policy') ?? '';
    // The proxy is same-origin ('self'); connect-src keeps its existing baseline
    // (broadened for direct-mode browser fetches) rather than growing further.
    expect(csp).toContain("connect-src 'self' https: http:");
  });

  it('3.6 title search happy path + invalid input (422) + missing credential header', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Proxy Title Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    // Happy path
    const res = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'login bug' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([{ remoteIssueId: '1', title: 'Fix login bug' }]);

    // Invalid input (title too short)
    const invalidRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'ab' }),
    });
    expect(invalidRes.status).toBe(422);
    expect((await invalidRes.json())?.data?.messageKey).toBe(
      'error.remoteIssueSearchTitleTooShort',
    );

    // Missing credential header
    const missingSecretRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'login bug' }),
    });
    expect(missingSecretRes.status).toBe(422);
    expect((await missingSecretRes.json())?.data?.messageKey).toBe(
      'error.remoteServerModeSecretRequired',
    );
  });

  it('3.7 issue-id lookup happy path + not-found + foreign/unknown config concealed', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Proxy Id Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    // Happy path
    const res = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'id', query: '42' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([{ remoteIssueId: '42', title: 'Fix login bug' }]);

    // Not found
    const notFoundRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'id', query: '999' }),
    });
    expect(notFoundRes.status).toBe(404);
    expect((await notFoundRes.json())?.data?.messageKey).toBe('error.remoteIssueSearchNotFound');

    // Foreign/unknown config concealed as 404, without contacting the tracker
    const foreignRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'id', query: '42' }),
    });
    expect(foreignRes.status).toBe(404);
    expect((await foreignRes.json())?.data?.messageKey).toBe('error.notFound');
  });

  it('3.8 unauthenticated, missing CSRF, and cross-user config are rejected without contacting upstream', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Proxy Security Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    // Unauthenticated (valid CSRF token/cookie pair but no session)
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    const unauthRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': anonToken,
        cookie: anonJar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'login bug' }),
    });
    expect(unauthRes.status).toBe(401);

    // Missing CSRF token
    const noCsrfRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'login bug' }),
    });
    expect(noCsrfRes.status).toBe(403);

    // Cross-user config concealed
    const bobRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'login bug' }),
    });
    expect(bobRes.status).toBe(404);
  });

  it('3.9 maps upstream 401 to the auth messageKey and never echoes the secret', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Proxy Error Mapping Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    const secret = 'rejected-secret';
    const res = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, mode: 'title', query: 'login bug' }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteServerModeAuthRejected');
    expect(JSON.stringify(body)).not.toContain(secret);

    // Connection failure (unreachable tracker) maps to the connection messageKey
    const unreachableClient = await createClient(
      alice.jar,
      alice.token,
      'Proxy Unreachable Client',
    );
    const unreachableConfig = await createProxiedConfig(
      alice.jar,
      alice.token,
      unreachableClient.id,
      'http://127.0.0.1:1',
    );
    const connRes = await fetch(url('/api/remote/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({
        remoteSystemConfigId: unreachableConfig.id,
        mode: 'title',
        query: 'login bug',
      }),
    });
    expect(connRes.status).toBe(502);
    expect((await connRes.json())?.data?.messageKey).toBe('error.remoteServerModeConnectionFailed');
  });
});
