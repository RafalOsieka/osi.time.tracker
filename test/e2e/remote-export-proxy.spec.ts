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
import { UNKNOWN_ID } from './support/fixtures';

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

async function createTracker(
  jar: CookieJar,
  token: string,
  name: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; name: string }> {
  const res = await fetch(url('/api/trackers'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({
      name,
      systemType: 'openproject',
      baseUrl: `https://${
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'tracker'
      }.example.com`,
      executionMode: 'client',
      roundingRule: 'none',
      ...overrides,
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
    const config = await createTracker(user.jar, user.token, 'Server Tracker ' + Date.now(), {
      executionMode: 'server',
      baseUrl: tracker.baseUrl,
    });
    const secret = 'good-secret';

    const accountRes = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({ trackerId: config.id }),
    });
    expect(accountRes.status).toBe(200);
    const accountBody = await accountRes.json();
    expect(accountBody).toEqual({ id: '7', name: 'Ada' });

    const logsRes = await fetch(url('/api/remote/time-logs'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        trackerId: config.id,
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
        [REMOTE_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        trackerId: config.id,
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody).toEqual({ remoteLogId: '99' });

    for (const body of [accountBody, logsBody, createBody]) {
      expect(JSON.stringify(body)).not.toContain(secret);
    }
    expect(tracker.seenAuth.some((value) => value.includes('Basic '))).toBe(true);
  });

  it('requires auth and secret, and rejects unknown configs', async () => {
    const user = await loginAs('exportproxy@example.com', 'secret');
    const config = await createTracker(user.jar, user.token, 'Server Tracker ' + Date.now(), {
      executionMode: 'server',
      baseUrl: tracker.baseUrl,
    });

    // Unauthenticated with a valid CSRF pair (no session) must be 401, not CSRF 403.
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    const anon = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': anonToken,
        cookie: anonJar.header(),
      },
      body: JSON.stringify({ trackerId: config.id }),
    });
    expect(anon.status).toBe(401);

    const missingSecret = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
      },
      body: JSON.stringify({ trackerId: config.id }),
    });
    expect(missingSecret.status).toBe(422);

    const unknown = await fetch(url('/api/remote/account'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ trackerId: UNKNOWN_ID }),
    });
    expect(unknown.status).toBe(404);
  });
});
