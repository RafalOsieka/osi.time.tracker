import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeClients = requireDocker();

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

describeClients('clients API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  // 3.6 list returns only own non-deleted clients, ordered by name
  it('3.6 list returns only own non-deleted clients, ordered by name', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');

    // Empty list initially
    const empty = await fetch(url('/api/clients'), { headers: { cookie: jar.header() } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    // Create two clients
    await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Zebra Corp' }),
    });
    await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Acme Inc' }),
    });

    const list = await fetch(url('/api/clients'), { headers: { cookie: jar.header() } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Acme Inc');
    expect(rows[1].name).toBe('Zebra Corp');

    // Soft-delete one and verify it's excluded
    const deleteRes = await fetch(url(`/api/clients/${rows[0].id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(deleteRes.status).toBe(200);

    const afterDelete = await fetch(url('/api/clients'), { headers: { cookie: jar.header() } });
    const afterRows = await afterDelete.json();
    expect(afterRows).toHaveLength(1);
    expect(afterRows[0].name).toBe('Zebra Corp');
  });

  // 3.7 create happy path + empty-name and duplicate-name error scenarios
  it('3.7 create happy path + validation errors', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');

    // Happy path
    const res = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Client' }),
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.name).toBe('New Client');
    expect(created.id).toBeDefined();

    // Empty name rejected
    const emptyRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: '' }),
    });
    expect(emptyRes.status).toBe(422);
    const emptyBody = await emptyRes.json();
    expect(emptyBody?.data?.messageKey).toBe('error.clientNameRequired');

    // Over-length name rejected
    const longName = 'a'.repeat(101); // CLIENT_NAME_MAX_LENGTH + 1
    const longRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: longName }),
    });
    expect(longRes.status).toBe(422);
    const longBody = await longRes.json();
    expect(longBody?.data?.messageKey).toBe('error.clientNameTooLong');
    expect(longBody?.data?.params).toEqual({ max: 100 });

    // Duplicate name rejected
    const dupRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'New Client' }),
    });
    expect(dupRes.status).toBe(422);
    const dupBody = await dupRes.json();
    expect(dupBody?.data?.messageKey).toBe('error.clientNameDuplicate');
  });

  // 3.8 patch happy path + foreign id → 404
  it('3.8 patch happy path + foreign id → 404', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');

    // Create a client to patch
    const createRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patch Me' }),
    });
    const client = await createRes.json();

    // Happy path rename
    const patchRes = await fetch(url(`/api/clients/${client.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patched Name' }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Patched Name');

    // Foreign/unknown id → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await fetch(url(`/api/clients/${fakeId}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    expect(notFound.status).toBe(404);
  });

  // 3.9 delete soft-deletes (row retained) + foreign id → 404
  it('3.9 delete soft-deletes (row retained) + foreign id → 404', async () => {
    const { jar, token } = await loginAs('alice@example.com', 'secret');

    const createRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Delete Me' }),
    });
    const client = await createRes.json();

    // Soft delete
    const delRes = await fetch(url(`/api/clients/${client.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    // Client no longer appears in list (soft-deleted)
    const listRes = await fetch(url('/api/clients'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === client.id)).toBeUndefined();

    // Deleting again (already soft-deleted) → 404
    const again = await fetch(url(`/api/clients/${client.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(again.status).toBe(404);

    // Foreign id → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await fetch(url(`/api/clients/${fakeId}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(notFound.status).toBe(404);
  });

  // 3.10 cross-user isolation + unauthenticated → 401
  it('3.10 cross-user isolation and unauthenticated → 401', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');

    // Alice creates a client
    const createRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Alice Only' }),
    });
    const aliceClient = await createRes.json();

    // Bob cannot see Alice's client in his list
    const bobList = await fetch(url('/api/clients'), { headers: { cookie: bob.jar.header() } });
    const bobRows = await bobList.json();
    expect(bobRows.find((r: { id: string }) => r.id === aliceClient.id)).toBeUndefined();

    // Bob cannot patch Alice's client → 404
    const bobPatch = await fetch(url(`/api/clients/${aliceClient.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(bobPatch.status).toBe(404);

    // Bob cannot delete Alice's client → 404
    const bobDelete = await fetch(url(`/api/clients/${aliceClient.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': bob.token, cookie: bob.jar.header() },
    });
    expect(bobDelete.status).toBe(404);

    // Unauthenticated → 401
    const unauth = await fetch(url('/api/clients'));
    expect(unauth.status).toBe(401);
  });
});
