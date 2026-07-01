import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeProjects = requireDocker();

/** Log in and return a primed CookieJar + CSRF token. */
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

async function createClient(
  jar: CookieJar,
  token: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(url('/api/clients'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

describeProjects('projects API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  // 3.6 list returns only own non-deleted projects, ordered by name, honors clientId filter
  it('3.6 list returns own non-deleted projects ordered by name and honors clientId filter', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');
    const clientA = await createClient(jar, token, 'Client A ' + Date.now());
    const clientB = await createClient(jar, token, 'Client B ' + Date.now());

    // Empty list initially
    const empty = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    // Create projects under both clients
    await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Zebra Project', clientId: clientA.id }),
    });
    await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Acme Project', clientId: clientB.id }),
    });

    const list = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Acme Project');
    expect(rows[1].name).toBe('Zebra Project');

    // Filter by clientId
    const filtered = await fetch(url(`/api/projects?clientId=${clientA.id}`), {
      headers: { cookie: jar.header() },
    });
    const filteredRows = await filtered.json();
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].name).toBe('Zebra Project');

    // Foreign/unknown clientId filter → empty list
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const foreignFiltered = await fetch(url(`/api/projects?clientId=${fakeId}`), {
      headers: { cookie: jar.header() },
    });
    expect(await foreignFiltered.json()).toEqual([]);

    // Soft-delete one and verify it's excluded
    const deleteRes = await fetch(url(`/api/projects/${rows[0].id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(deleteRes.status).toBe(200);

    const afterDelete = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    const afterRows = await afterDelete.json();
    expect(afterRows).toHaveLength(1);
    expect(afterRows[0].name).toBe('Zebra Project');
  });

  // 3.7 create happy path + validation errors + same name under a different client allowed
  it('3.7 create happy path + validation errors', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');
    const clientA = await createClient(jar, token, 'Client Create A ' + Date.now());
    const clientB = await createClient(jar, token, 'Client Create B ' + Date.now());

    // Happy path
    const res = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Project', clientId: clientA.id }),
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.name).toBe('New Project');
    expect(created.clientId).toBe(clientA.id);
    expect(created.id).toBeDefined();

    // Empty name rejected
    const emptyRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: '', clientId: clientA.id }),
    });
    expect(emptyRes.status).toBe(422);
    const emptyBody = await emptyRes.json();
    expect(emptyBody?.data?.messageKey).toBe('error.projectNameRequired');

    // Missing clientId rejected
    const noClientRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'No Client' }),
    });
    expect(noClientRes.status).toBe(422);
    const noClientBody = await noClientRes.json();
    expect(noClientBody?.data?.messageKey).toBe('error.projectClientRequired');

    // Over-length name rejected
    const longName = 'a'.repeat(101); // PROJECT_NAME_MAX_LENGTH + 1
    const longRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: longName, clientId: clientA.id }),
    });
    expect(longRes.status).toBe(422);
    const longBody = await longRes.json();
    expect(longBody?.data?.messageKey).toBe('error.projectNameTooLong');
    expect(longBody?.data?.params).toEqual({ max: 100 });

    // Duplicate name under same client rejected
    const dupRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Project', clientId: clientA.id }),
    });
    expect(dupRes.status).toBe(422);
    const dupBody = await dupRes.json();
    expect(dupBody?.data?.messageKey).toBe('error.projectNameDuplicate');

    // Same name under a different client allowed
    const differentClientRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Project', clientId: clientB.id }),
    });
    expect(differentClientRes.status).toBe(200);
  });

  // 3.8 create/patch with a foreign or unknown clientId → 404
  it('3.8 create/patch with a foreign or unknown clientId → 404', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const bobClient = await createClient(bob.jar, bob.token, 'Bob Client ' + Date.now());
    const fakeId = '00000000-0000-0000-0000-000000000000';

    // Create with unknown clientId → 404
    const unknownRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Ghost Project', clientId: fakeId }),
    });
    expect(unknownRes.status).toBe(404);

    // Create with foreign (Bob's) clientId → 404
    const foreignRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Foreign Project', clientId: bobClient.id }),
    });
    expect(foreignRes.status).toBe(404);

    // Create a valid project, then patch its clientId to a foreign client → 404
    const aliceClient = await createClient(alice.jar, alice.token, 'Alice Client ' + Date.now());
    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Patchable Project', clientId: aliceClient.id }),
    });
    const project = await createRes.json();

    const patchForeignRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Patchable Project', clientId: bobClient.id }),
    });
    expect(patchForeignRes.status).toBe(404);
  });

  // 3.9 patch happy path (name + client change) + foreign project id → 404
  it('3.9 patch happy path (name + client change) + foreign project id → 404', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');
    const clientA = await createClient(jar, token, 'Patch Client A ' + Date.now());
    const clientC = await createClient(jar, token, 'Patch Client C ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patch Me', clientId: clientA.id }),
    });
    const project = await createRes.json();

    // Happy path rename + client change
    const patchRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patched Name', clientId: clientC.id }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Patched Name');
    expect(patched.clientId).toBe(clientC.id);

    // Foreign/unknown id → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await fetch(url(`/api/projects/${fakeId}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Ghost', clientId: clientA.id }),
    });
    expect(notFound.status).toBe(404);
  });

  // 3.9a rename a project whose client is soft-deleted succeeds when clientId is unchanged
  it('3.9a rename a project whose client is soft-deleted succeeds when clientId is unchanged', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');
    const client = await createClient(jar, token, 'Soft Delete Client ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Original Name', clientId: client.id }),
    });
    const project = await createRes.json();

    // Soft-delete the client
    const delRes = await fetch(url(`/api/clients/${client.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    // Rename the project keeping the same (now soft-deleted) clientId → should succeed
    const patchRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Renamed Name', clientId: client.id }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Renamed Name');
    expect(patched.clientId).toBe(client.id);
    expect(patched.clientName).toBe(client.name);
  });

  // 3.9b list still returns clientName for a project whose client is soft-deleted
  it('3.9b list still returns clientName for a project whose client is soft-deleted', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');
    const client = await createClient(jar, token, 'Soft Delete List Client ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Orphaned Project', clientId: client.id }),
    });
    const project = await createRes.json();
    expect(project.clientName).toBe(client.name);

    // Soft-delete the client
    const delRes = await fetch(url(`/api/clients/${client.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    // The project should still show the client's name in the list
    const listRes = await fetch(url(`/api/projects?clientId=${client.id}`), {
      headers: { cookie: jar.header() },
    });
    const rows = await listRes.json();
    const found = rows.find((r: { id: string }) => r.id === project.id);
    expect(found).toBeDefined();
    expect(found.clientName).toBe(client.name);
  });

  // 3.10 delete soft-deletes (row retained) + foreign id → 404
  it('3.10 delete soft-deletes (row retained) + foreign id → 404', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');
    const client = await createClient(jar, token, 'Delete Client ' + Date.now());

    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Delete Me', clientId: client.id }),
    });
    const project = await createRes.json();

    // Soft delete
    const delRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    // Project no longer appears in list (soft-deleted)
    const listRes = await fetch(url('/api/projects'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === project.id)).toBeUndefined();

    // Deleting again (already soft-deleted) → 404
    const again = await fetch(url(`/api/projects/${project.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(again.status).toBe(404);

    // Foreign id → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await fetch(url(`/api/projects/${fakeId}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(notFound.status).toBe(404);
  });

  // 3.11 cross-user isolation + unauthenticated → 401
  it('3.11 cross-user isolation and unauthenticated → 401', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const aliceClient = await createClient(
      alice.jar,
      alice.token,
      'Isolation Client ' + Date.now(),
    );

    // Alice creates a project
    const createRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Alice Only', clientId: aliceClient.id }),
    });
    const aliceProject = await createRes.json();

    // Bob cannot see Alice's project in his list
    const bobList = await fetch(url('/api/projects'), { headers: { cookie: bob.jar.header() } });
    const bobRows = await bobList.json();
    expect(bobRows.find((r: { id: string }) => r.id === aliceProject.id)).toBeUndefined();

    // Bob cannot patch Alice's project → 404
    const bobPatch = await fetch(url(`/api/projects/${aliceProject.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
      },
      body: JSON.stringify({ name: 'Hijacked', clientId: aliceClient.id }),
    });
    expect(bobPatch.status).toBe(404);

    // Bob cannot delete Alice's project → 404
    const bobDelete = await fetch(url(`/api/projects/${aliceProject.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': bob.token, cookie: bob.jar.header() },
    });
    expect(bobDelete.status).toBe(404);

    // Unauthenticated → 401
    const unauth = await fetch(url('/api/projects'));
    expect(unauth.status).toBe(401);
  });
});
