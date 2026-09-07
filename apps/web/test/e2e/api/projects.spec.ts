import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { seedAndLogin } from '../helpers/session';
import { createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { MALFORMED_ID, UNKNOWN_ID } from '../helpers/fixtures';

const describeProjects = requireDocker();

describeProjects('projects API integration', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('list returns own non-deleted projects ordered by name and honors trackerId filter', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const trackerA = await createTracker(jar, token, 'Tracker A ' + Date.now());
    const trackerB = await createTracker(jar, token, 'Tracker B ' + Date.now());

    const empty = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Zebra Project', trackerId: trackerA.id }),
    });
    await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Acme Project', trackerId: trackerB.id }),
    });
    await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Local Project' }),
    });

    const list = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows).toHaveLength(3);
    expect(rows.map((r: { name: string }) => r.name)).toEqual([
      'Acme Project',
      'Local Project',
      'Zebra Project',
    ]);

    const filtered = await fetch(url(`/api/projects?trackerId=${trackerA.id}`), {
      headers: { cookie: jar.header() },
    });
    const filteredRows = await filtered.json();
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].name).toBe('Zebra Project');
    expect(filteredRows[0].trackerName).toBe(trackerA.name);

    const foreignFiltered = await fetch(url(`/api/projects?trackerId=${UNKNOWN_ID}`), {
      headers: { cookie: jar.header() },
    });
    expect(await foreignFiltered.json()).toEqual([]);

    const deleteRes = await fetch(url(`/api/projects/${rows[0].id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(deleteRes.status).toBe(200);

    const afterDelete = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    const afterRows = await afterDelete.json();
    expect(afterRows).toHaveLength(2);
  });

  it('create happy path for local and tracker-linked projects + validation errors', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const trackerA = await createTracker(jar, token, 'Tracker Create A ' + Date.now());
    const trackerB = await createTracker(jar, token, 'Tracker Create B ' + Date.now());

    const localRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Local Only' }),
    });
    expect(localRes.status).toBe(200);
    const local = await localRes.json();
    expect(local.name).toBe('Local Only');
    expect(local.trackerId).toBeNull();
    expect(local.trackerName).toBeNull();

    const res = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Project', trackerId: trackerA.id }),
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.name).toBe('New Project');
    expect(created.trackerId).toBe(trackerA.id);
    expect(created.trackerName).toBe(trackerA.name);
    expect(created.id).toBeDefined();

    const emptyRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: '', trackerId: trackerA.id }),
    });
    expect(emptyRes.status).toBe(422);
    expect((await emptyRes.json())?.data?.messageKey).toBe('error.projectNameRequired');

    const longName = 'a'.repeat(101);
    const longRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: longName, trackerId: trackerA.id }),
    });
    expect(longRes.status).toBe(422);
    const longBody = await longRes.json();
    expect(longBody?.data?.messageKey).toBe('error.projectNameTooLong');
    expect(longBody?.data?.params).toEqual({ max: 100 });

    const dupRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Project', trackerId: trackerA.id }),
    });
    expect(dupRes.status).toBe(422);
    expect((await dupRes.json())?.data?.messageKey).toBe('error.projectNameDuplicate');

    const differentTrackerRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Project', trackerId: trackerB.id }),
    });
    expect(differentTrackerRes.status).toBe(200);

    const dupLocal = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Local Only' }),
    });
    expect(dupLocal.status).toBe(422);
    expect((await dupLocal.json())?.data?.messageKey).toBe('error.projectNameDuplicate');
  });

  it('create/patch with a foreign or unknown trackerId → 404', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const bobTracker = await createTracker(bob.jar, bob.token, 'Bob Tracker ' + Date.now());

    const unknownRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Ghost Project', trackerId: UNKNOWN_ID }),
    });
    expect(unknownRes.status).toBe(404);

    const malformedRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Bad Id Project', trackerId: MALFORMED_ID }),
    });
    expect(malformedRes.status).toBe(422);
    expect((await malformedRes.json())?.data?.messageKey).toBe('error.projectTrackerInvalid');

    const foreignRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Foreign Project', trackerId: bobTracker.id }),
    });
    expect(foreignRes.status).toBe(404);

    const aliceTracker = await createTracker(alice.jar, alice.token, 'Alice Tracker ' + Date.now());
    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Patchable Project', trackerId: aliceTracker.id }),
    });
    const project = await createRes.json();

    const patchForeignRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Patchable Project', trackerId: bobTracker.id }),
    });
    expect(patchForeignRes.status).toBe(404);
  });

  it('patch happy path (name + tracker change + detach) + foreign project id → 404', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const trackerA = await createTracker(jar, token, 'Patch Tracker A ' + Date.now());
    const trackerC = await createTracker(jar, token, 'Patch Tracker C ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patch Me', trackerId: trackerA.id }),
    });
    const project = await createRes.json();

    const patchRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patched Name', trackerId: trackerC.id }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Patched Name');
    expect(patched.trackerId).toBe(trackerC.id);
    expect(patched.trackerName).toBe(trackerC.name);

    const detachRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patched Name', trackerId: null }),
    });
    expect(detachRes.status).toBe(200);
    const detached = await detachRes.json();
    expect(detached.trackerId).toBeNull();
    expect(detached.trackerName).toBeNull();

    const notFound = await fetch(url(`/api/projects/${UNKNOWN_ID}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Ghost', trackerId: trackerA.id }),
    });
    expect(notFound.status).toBe(404);
  });

  it('patch to a duplicate name in the same tracker scope is rejected', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Dup Scope Tracker ' + Date.now());

    const firstRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Keep Name', trackerId: tracker.id }),
    });
    expect(firstRes.status).toBe(200);

    const secondRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Rename Me', trackerId: tracker.id }),
    });
    expect(secondRes.status).toBe(200);
    const second = await secondRes.json();

    const dupPatch = await fetch(url(`/api/projects/${second.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Keep Name', trackerId: tracker.id }),
    });
    expect(dupPatch.status).toBe(422);
    expect((await dupPatch.json())?.data?.messageKey).toBe('error.projectNameDuplicate');
  });

  it('rename a project whose tracker is soft-deleted succeeds when trackerId is unchanged', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Soft Delete Tracker ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Original Name', trackerId: tracker.id }),
    });
    const project = await createRes.json();

    const delRes = await fetch(url(`/api/trackers/${tracker.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const patchRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Renamed Name', trackerId: tracker.id }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Renamed Name');
    expect(patched.trackerId).toBe(tracker.id);
    // Soft-deleted tracker name remains populated for display/edit seed (REQ-084).
    expect(patched.trackerName).toBe(tracker.name);
  });

  it('list keeps trackerName for a project whose tracker is soft-deleted', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Soft Delete List Tracker ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Orphaned Project', trackerId: tracker.id }),
    });
    const project = await createRes.json();
    expect(project.trackerName).toBe(tracker.name);

    const delRes = await fetch(url(`/api/trackers/${tracker.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const listRes = await fetch(url(`/api/projects?trackerId=${tracker.id}`), {
      headers: { cookie: jar.header() },
    });
    const rows = await listRes.json();
    const found = rows.find((r: { id: string }) => r.id === project.id);
    expect(found).toBeDefined();
    expect(found.trackerId).toBe(tracker.id);
    expect(found.trackerName).toBe(tracker.name);
  });

  it('patch with name only keeps the current trackerId', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Pin Tracker ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Pin Me', trackerId: tracker.id }),
    });
    const project = await createRes.json();

    const patchRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Pinned Name' }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Pinned Name');
    expect(patched.trackerId).toBe(tracker.id);
  });

  it('delete soft-deletes (row retained) + foreign id → 404', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Delete Tracker ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Delete Me', trackerId: tracker.id }),
    });
    const project = await createRes.json();

    const delRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const listRes = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === project.id)).toBeUndefined();

    const again = await fetch(url(`/api/projects/${project.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(again.status).toBe(404);

    const notFound = await fetch(url(`/api/projects/${UNKNOWN_ID}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(notFound.status).toBe(404);
  });

  it('cross-user isolation and unauthenticated → 401', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const aliceTracker = await createTracker(
      alice.jar,
      alice.token,
      'Isolation Tracker ' + Date.now(),
    );

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Alice Only', trackerId: aliceTracker.id }),
    });
    const aliceProject = await createRes.json();

    const bobList = await fetch(url('/api/projects'), { headers: { cookie: bob.jar.header() } });
    const bobRows = await bobList.json();
    expect(bobRows.find((r: { id: string }) => r.id === aliceProject.id)).toBeUndefined();

    const bobPatch = await fetch(url(`/api/projects/${aliceProject.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
      },
      body: JSON.stringify({ name: 'Hijacked', trackerId: aliceTracker.id }),
    });
    expect(bobPatch.status).toBe(404);

    const bobDelete = await fetch(url(`/api/projects/${aliceProject.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': bob.token, cookie: bob.jar.header() },
    });
    expect(bobDelete.status).toBe(404);

    const unauth = await fetch(url('/api/projects'));
    expect(unauth.status).toBe(401);
  });
});
