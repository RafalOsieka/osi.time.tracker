import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';

const describeRemoteSyncGuard = requireDocker();

describeRemoteSyncGuard('remote sync page access guard', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('redirects an unauthenticated request to /login with the target as a redirect param', async () => {
    const res = await fetch(url('/sync/2026-03-15'), { redirect: 'follow' });
    expect(res.url).toContain('/login');
    expect(decodeURIComponent(res.url)).toContain('/sync/2026-03-15');
  });
});
