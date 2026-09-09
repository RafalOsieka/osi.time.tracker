import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { seedAndLogin } from '../helpers/session';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';

const describeRemoteProxyRemoved = requireDocker();

const FORMER_REMOTE_OPERATION_ROUTES = [
  '/api/remote/search',
  '/api/remote/activities',
  '/api/remote/account',
  '/api/remote/time-logs',
  '/api/remote/time-logs-range',
  '/api/remote/time-entries',
] as const;

describeRemoteProxyRemoved('removed remote operation proxy routes', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('does not expose former /api/remote operation endpoints while other APIs still work', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);

    for (const path of FORMER_REMOTE_OPERATION_ROUTES) {
      const res = await fetch(url(path), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'csrf-token': token,
          cookie: jar.header(),
        },
        body: JSON.stringify({ trackerId: '01900000-0000-7000-8000-000000000001' }),
      });
      expect(res.status, path).toBe(404);
    }

    const trackers = await fetch(url('/api/trackers'), { headers: { cookie: jar.header() } });
    expect(trackers.status).toBe(200);
    expect(await trackers.json()).toEqual([]);

    const session = await fetch(url('/api/auth/session'), { headers: { cookie: jar.header() } });
    expect(session.status).toBe(200);
  });

  it('keeps connect-src at the direct-mode baseline without a proxy route', async () => {
    const res = await fetch(url('/'));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("connect-src 'self' https: http:");
  });
});
