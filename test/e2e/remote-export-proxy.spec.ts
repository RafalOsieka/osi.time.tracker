import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { REMOTE_PROXY_SECRET_HEADER } from '../../shared/config/remote-proxy';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeRemoteExportProxy = requireDocker();

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
      executionMode: 'client',
      transportMode: 'proxied',
      roundingRule: 'none',
    }),
  });
  return res.json();
}

function startFakeTracker(): Promise<{ server: Server; baseUrl: string; seenAuth: string[] }> {
  const seenAuth: string[] = [];
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const authHeader = req.headers.authorization ?? '';
      seenAuth.push(authHeader);
      const decoded = authHeader.startsWith('Basic ')
        ? Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf-8')
        : '';
      if (decoded.includes('rejected-secret')) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      const path = req.url ?? '';
      if (path.startsWith('/api/v3/users/me')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 7, name: 'Ada' }));
        return;
      }

      if (path.startsWith('/api/v3/time_entries') && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            _embedded: {
              elements: [
                {
                  id: 11,
                  spentOn: '2026-03-15',
                  hours: 'PT1H',
                  _links: {
                    workPackage: { href: '/api/v3/work_packages/42' },
                    activity: { href: '/api/v3/time_entries/activities/1', title: 'Dev' },
                    user: { href: '/api/v3/users/7' },
                  },
                },
              ],
            },
          }),
        );
        return;
      }

      if (path.startsWith('/api/v3/time_entries') && req.method === 'POST') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 99 }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, seenAuth });
    });
  });
}

describeRemoteExportProxy('remote export proxy API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'exportproxy@example.com', displayName: 'Export Proxy' }]);
  await setupServer({ databaseUrl: dbUrl });

  let tracker: { server: Server; baseUrl: string; seenAuth: string[] };
  beforeAll(async () => {
    tracker = await startFakeTracker();
  });
  afterAll(() => {
    tracker.server.close();
  });

  it('forwards account, time-log, and create operations without echoing secrets', async () => {
    const user = await loginAs('exportproxy@example.com', 'secret');
    const client = await createClient(user.jar, user.token, 'Export Proxy Client');
    const config = await createProxiedConfig(user.jar, user.token, client.id, tracker.baseUrl);
    const secret = 'good-secret';

    const accountRes = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_PROXY_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id }),
    });
    expect(accountRes.status).toBe(200);
    expect(await accountRes.json()).toEqual({ id: '7', name: 'Ada' });

    const logsRes = await fetch(url('/api/remote/time-logs'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_PROXY_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        remoteSystemConfigId: config.id,
        spentOn: '2026-03-15',
        workPackageIds: ['42'],
        userId: '7',
      }),
    });
    expect(logsRes.status).toBe(200);
    const logsBody = await logsRes.json();
    expect(logsBody.logs).toHaveLength(1);
    expect(logsBody.logs[0].remoteLogId).toBe('11');

    const createRes = await fetch(url('/api/remote/time-entries'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_PROXY_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        remoteSystemConfigId: config.id,
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      }),
    });
    expect(createRes.status).toBe(200);
    expect(await createRes.json()).toEqual({ remoteLogId: '99' });

    for (const res of [accountRes, logsRes, createRes]) {
      expect(
        JSON.stringify(
          await res
            .clone()
            .json()
            .catch(() => ({})),
        ),
      ).not.toContain(secret);
    }
    expect(tracker.seenAuth.some((value) => value.includes('Basic '))).toBe(true);
  });

  it('requires auth and secret, and rejects unknown configs', async () => {
    const user = await loginAs('exportproxy@example.com', 'secret');
    const client = await createClient(user.jar, user.token, 'Export Proxy Guard Client');
    const config = await createProxiedConfig(user.jar, user.token, client.id, tracker.baseUrl);

    const anon = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ remoteSystemConfigId: config.id }),
    });
    expect(anon.status).toBe(401);

    const missingSecret = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id }),
    });
    expect(missingSecret.status).toBe(422);

    const unknown = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_PROXY_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: '00000000-0000-0000-0000-000000000000' }),
    });
    expect(unknown.status).toBe(404);
  });
});
