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

const describeRemoteActivitiesProxy = requireDocker();

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

/** Minimal fake OpenProject server serving the project-scoped time-entry form. */
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

      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');

        if (rawBody.includes('/work_packages/no-log-time')) {
          res.writeHead(403, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'forbidden' }));
          return;
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            _embedded: {
              schema: {
                activity: {
                  _embedded: {
                    allowedValues: [
                      { id: 1, name: 'Development' },
                      { id: 2, name: 'Management' },
                    ],
                  },
                },
              },
            },
          }),
        );
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describeRemoteActivitiesProxy('remote activities proxy API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'alice@example.com', displayName: 'Alice' }]);
  await setupServer({ databaseUrl: dbUrl });

  let tracker: { server: Server; baseUrl: string };
  beforeAll(async () => {
    tracker = await startFakeTracker();
  });
  afterAll(() => {
    tracker.server.close();
  });

  it('happy path returns the adapter-neutral activity options', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Activities Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    const res = await fetch(url('/api/remote/activities'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, remoteIssueId: '42' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options).toEqual([
      { id: '1', name: 'Development' },
      { id: '2', name: 'Management' },
    ]);
  });

  it('treats an upstream 403 (work package does not allow time logging) as an empty result', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Activities No-Log-Time Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    const res = await fetch(url('/api/remote/activities'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, remoteIssueId: 'no-log-time' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options).toEqual([]);
  });

  it('maps an upstream auth rejection to the translated messageKey without echoing the secret', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Activities Error Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    const secret = 'rejected-secret';
    const res = await fetch(url('/api/remote/activities'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, remoteIssueId: '42' }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteServerModeAuthRejected');
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it('requires the secret header and rejects a missing/foreign configuration', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Activities Missing Client');
    const config = await createProxiedConfig(alice.jar, alice.token, client.id, tracker.baseUrl);

    const missingSecretRes = await fetch(url('/api/remote/activities'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ remoteSystemConfigId: config.id, remoteIssueId: '42' }),
    });
    expect(missingSecretRes.status).toBe(422);
    expect((await missingSecretRes.json())?.data?.messageKey).toBe(
      'error.remoteServerModeSecretRequired',
    );

    const unknownConfigRes = await fetch(url('/api/remote/activities'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
        [REMOTE_SECRET_HEADER]: 'good-secret',
      },
      body: JSON.stringify({
        remoteSystemConfigId: '00000000-0000-0000-0000-000000000000',
        remoteIssueId: '42',
      }),
    });
    expect(unknownConfigRes.status).toBe(404);
  });
});
