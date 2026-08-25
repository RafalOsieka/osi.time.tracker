import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { seedAndLogin } from '../helpers/session';
import { createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { UNKNOWN_ID } from '../helpers/fixtures';
import type { JsonObject } from '../../../shared/types/json';

const describeTrackers = requireDocker();

function trackerBody(name: string, overrides: JsonObject = {}) {
  return {
    name,
    systemType: 'openproject',
    baseUrl: 'https://op.example.com',
    executionMode: 'client',
    roundingRule: 'none',
    ...overrides,
  };
}

describeTrackers('trackers API integration', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('list returns only own non-deleted trackers, ordered by name', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);

    const empty = await fetch(url('/api/trackers'), { headers: { cookie: jar.header() } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    await createTracker(jar, token, 'Zebra Tracker');
    await createTracker(jar, token, 'Acme Tracker', { baseUrl: 'https://acme.example.com' });

    const list = await fetch(url('/api/trackers'), { headers: { cookie: jar.header() } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Acme Tracker');
    expect(rows[1].name).toBe('Zebra Tracker');
    expect(rows[0].apiKey).toBeUndefined();
    expect(rows[0].secret).toBeUndefined();

    const deleteRes = await fetch(url(`/api/trackers/${rows[0].id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(deleteRes.status).toBe(200);

    const afterDelete = await fetch(url('/api/trackers'), { headers: { cookie: jar.header() } });
    const afterRows = await afterDelete.json();
    expect(afterRows).toHaveLength(1);
    expect(afterRows[0].name).toBe('Zebra Tracker');
  });

  it('create happy path + validation errors', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);

    const res = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody('New Tracker')),
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.name).toBe('New Tracker');
    expect(created.id).toBeDefined();
    expect(created.systemType).toBe('openproject');
    expect(created.executionMode).toBe('client');
    expect(created.apiKey).toBeUndefined();
    expect(created.secret).toBeUndefined();

    const emptyRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody('')),
    });
    expect(emptyRes.status).toBe(422);
    const emptyBody = await emptyRes.json();
    expect(emptyBody?.data?.messageKey).toBe('error.trackerNameRequired');

    const longName = 'a'.repeat(101);
    const longRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody(longName)),
    });
    expect(longRes.status).toBe(422);
    const longBody = await longRes.json();
    expect(longBody?.data?.messageKey).toBe('error.trackerNameTooLong');
    expect(longBody?.data?.params).toEqual({ max: 100 });

    const dupRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody('New Tracker', { baseUrl: 'https://other.example.com' })),
    });
    expect(dupRes.status).toBe(422);
    const dupBody = await dupRes.json();
    expect(dupBody?.data?.messageKey).toBe('error.trackerNameDuplicate');

    const invalidUrl = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody('Bad URL', { baseUrl: 'not-a-url' })),
    });
    expect(invalidUrl.status).toBe(422);
    expect((await invalidUrl.json())?.data?.messageKey).toBe('error.trackerBaseUrlInvalid');
  });

  it('create defaults executionMode to client and accepts server/nearest rounding', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const { executionMode: _ignored, ...withoutMode } = trackerBody('Default Mode Tracker');

    const defaultRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(withoutMode),
    });
    expect(defaultRes.status).toBe(200);
    expect((await defaultRes.json()).executionMode).toBe('client');

    const serverRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(
        trackerBody('Server Mode Tracker', {
          executionMode: 'server',
          roundingRule: 'nearest_30m',
          baseUrl: 'https://server.example.com',
        }),
      ),
    });
    expect(serverRes.status).toBe(200);
    const serverBody = await serverRes.json();
    expect(serverBody.executionMode).toBe('server');
    expect(serverBody.roundingRule).toBe('nearest_30m');

    const invalidMode = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody('Bad Mode', { executionMode: 'tunneled' })),
    });
    expect(invalidMode.status).toBe(422);
    expect((await invalidMode.json())?.data?.messageKey).toBe('error.trackerExecutionModeRequired');
  });

  it('patch happy path + foreign id → 404', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Patch Me');

    const patchRes = await fetch(url(`/api/trackers/${tracker.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(
        trackerBody('Patched Name', {
          systemType: 'redmine',
          baseUrl: 'https://rm.example.com',
          roundingRule: 'up_15m',
        }),
      ),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Patched Name');
    expect(patched.systemType).toBe('redmine');
    expect(patched.baseUrl).toBe('https://rm.example.com');
    expect(patched.roundingRule).toBe('up_15m');
    expect(patched.secret).toBeUndefined();

    const notFound = await fetch(url(`/api/trackers/${UNKNOWN_ID}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody('Ghost')),
    });
    expect(notFound.status).toBe(404);
  });

  it('patch rename into a colliding tracker name is rejected', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const kept = await createTracker(jar, token, 'Kept Tracker ' + Date.now());
    const other = await createTracker(jar, token, 'Rename Tracker ' + Date.now(), {
      baseUrl: 'https://rename.example.com',
    });

    const dupPatch = await fetch(url(`/api/trackers/${other.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(trackerBody(kept.name, { baseUrl: 'https://rename.example.com' })),
    });
    expect(dupPatch.status).toBe(422);
    expect((await dupPatch.json())?.data?.messageKey).toBe('error.trackerNameDuplicate');
  });

  it('delete soft-deletes (row retained) + foreign id → 404', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Delete Me');

    const delRes = await fetch(url(`/api/trackers/${tracker.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const listRes = await fetch(url('/api/trackers'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === tracker.id)).toBeUndefined();

    const again = await fetch(url(`/api/trackers/${tracker.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(again.status).toBe(404);

    const notFound = await fetch(url(`/api/trackers/${UNKNOWN_ID}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(notFound.status).toBe(404);
  });

  it('cross-user isolation and unauthenticated → 401', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);

    const aliceTracker = await createTracker(alice.jar, alice.token, 'Alice Only');

    const bobList = await fetch(url('/api/trackers'), { headers: { cookie: bob.jar.header() } });
    const bobRows = await bobList.json();
    expect(bobRows.find((r: { id: string }) => r.id === aliceTracker.id)).toBeUndefined();

    const bobPatch = await fetch(url(`/api/trackers/${aliceTracker.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
      },
      body: JSON.stringify(trackerBody('Hijacked')),
    });
    expect(bobPatch.status).toBe(404);

    const bobDelete = await fetch(url(`/api/trackers/${aliceTracker.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': bob.token, cookie: bob.jar.header() },
    });
    expect(bobDelete.status).toBe(404);

    const unauth = await fetch(url('/api/trackers'));
    expect(unauth.status).toBe(401);
  });
});
