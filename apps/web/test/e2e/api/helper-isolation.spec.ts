import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { seedUser } from '../helpers/seed';
import { seedAndLogin } from '../helpers/session';
import { createTracker } from '../helpers/http';

const describeIsolation = requireDocker();

describeIsolation('e2e helper isolation', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('seedUser returns a distinct email on every call', async () => {
    const a = await seedUser(dbUrl);
    const b = await seedUser(dbUrl);
    expect(a.email).not.toBe(b.email);
    expect(a.id).not.toBe(b.id);
  });

  it("user A's trackers are not listed for user B", async () => {
    const alice = await seedAndLogin(dbUrl, { displayName: 'Alice' });
    const bob = await seedAndLogin(dbUrl, { displayName: 'Bob' });

    await createTracker(alice.jar, alice.token, 'Alice Only Tracker');
    await createTracker(bob.jar, bob.token, 'Bob Only Tracker');

    const aliceList = await fetch(url('/api/trackers'), {
      headers: { cookie: alice.jar.header() },
    });
    const bobList = await fetch(url('/api/trackers'), { headers: { cookie: bob.jar.header() } });
    expect(aliceList.status).toBe(200);
    expect(bobList.status).toBe(200);

    const aliceRows: { name: string }[] = await aliceList.json();
    const bobRows: { name: string }[] = await bobList.json();
    const aliceNames = aliceRows.map((row) => row.name);
    const bobNames = bobRows.map((row) => row.name);
    expect(aliceNames).toEqual(['Alice Only Tracker']);
    expect(bobNames).toEqual(['Bob Only Tracker']);
  });
});
