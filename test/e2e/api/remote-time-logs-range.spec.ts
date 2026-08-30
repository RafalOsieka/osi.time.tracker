import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { url } from '../helpers/url';
import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import { CookieJar, primeCsrf } from '../helpers/auth';
import { seedAndLogin } from '../helpers/session';
import { createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';

const describeTimeLogsRange = requireDocker();

function startFakeTracker(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = req.url ?? '';
      if (path.startsWith('/api/v3/time_entries') && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            _embedded: {
              elements: [
                {
                  id: 88,
                  spentOn: '2026-08-12',
                  hours: 'PT2H',
                  _links: {
                    entity: { href: '/api/v3/work_packages/99' },
                    user: { href: '/api/v3/users/7' },
                  },
                },
              ],
            },
          }),
        );
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address instanceof Object && 'port' in address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describeTimeLogsRange('remote date-range time-logs proxy', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  let tracker: { server: Server; baseUrl: string };
  beforeAll(async () => {
    tracker = await startFakeTracker();
  });
  afterAll(() => {
    tracker.server.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    const res = await fetch(url('/api/remote/time-logs-range'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': anonToken,
        cookie: anonJar.header(),
      },
      body: JSON.stringify({
        trackerId: '01900000-0000-7000-8000-000000000001',
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 when the secret header is missing', async () => {
    const user = await seedAndLogin(dbUrl);
    const config = await createTracker(user.jar, user.token, 'Range Tracker ' + Date.now(), {
      executionMode: 'server',
      baseUrl: tracker.baseUrl,
    });
    const res = await fetch(url('/api/remote/time-logs-range'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
      },
      body: JSON.stringify({
        trackerId: config.id,
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteServerModeSecretRequired');
  });

  it('forwards a range fetch and returns adapter-neutral logs', async () => {
    const user = await seedAndLogin(dbUrl);
    const config = await createTracker(user.jar, user.token, 'Range Tracker ' + Date.now(), {
      executionMode: 'server',
      baseUrl: tracker.baseUrl,
    });
    const res = await fetch(url('/api/remote/time-logs-range'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({
        trackerId: config.id,
        from: '2026-08-01',
        to: '2026-08-31',
        userId: '7',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].remoteLogId).toBe('88');
    expect(body.logs[0].remoteIssueId).toBe('99');
    expect(body.logs[0].durationSeconds).toBe(7200);
  });
});
