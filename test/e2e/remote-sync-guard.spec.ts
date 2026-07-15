import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeRemoteSyncGuard = requireDocker();

describeRemoteSyncGuard('remote sync page access guard', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'syncguard@example.com', displayName: 'Guard' }]);
  await setupServer({ databaseUrl: dbUrl });

  it('redirects an unauthenticated request to /login with the target as a redirect param', async () => {
    const res = await fetch(url('/sync/2026-03-15'), { redirect: 'follow' });
    expect(res.url).toContain('/login');
    expect(decodeURIComponent(res.url)).toContain('/sync/2026-03-15');
  });
});
