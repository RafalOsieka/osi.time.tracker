import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeRemoteConfig = requireDocker();

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

async function createClient(jar: CookieJar, token: string, name: string): Promise<{ id: string }> {
  const res = await fetch(url('/api/clients'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

const validConfig = {
  systemType: 'redmine',
  baseUrl: 'https://redmine.example.com',
  executionMode: 'client',
  roundingRule: 'none',
};

describeRemoteConfig('remote system config API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  // 3.4 GET
  it('3.4 get returns config for owner; not-found for non-owner; 401 unauthenticated', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Get Client');

    // Not found before it's created
    const beforeRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      headers: { cookie: alice.jar.header() },
    });
    expect(beforeRes.status).toBe(404);

    // Create config
    await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify(validConfig),
    });

    // Owner can read it
    const res = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      headers: { cookie: alice.jar.header() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientId).toBe(client.id);
    expect(body.baseUrl).toBe(validConfig.baseUrl);
    expect(body.apiKey).toBeUndefined();

    // Non-owner gets not-found
    const bobRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      headers: { cookie: bob.jar.header() },
    });
    expect(bobRes.status).toBe(404);

    // Unauthenticated → 401
    const unauth = await fetch(url(`/api/clients/${client.id}/remote-config`));
    expect(unauth.status).toBe(401);
  });

  // 3.5 PUT
  it('3.5 put creates then upserts; rejects invalid body and foreign client', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Put Client');

    // Happy-path create
    const createRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify(validConfig),
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.systemType).toBe('redmine');

    // Upsert updates the single config (same id, new values)
    const updateRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ ...validConfig, roundingRule: 'up_15m' }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.id).toBe(created.id);
    expect(updated.roundingRule).toBe('up_15m');

    // Invalid body rejected
    const invalidRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ ...validConfig, baseUrl: 'not-a-url' }),
    });
    expect(invalidRes.status).toBe(422);
    const invalidBody = await invalidRes.json();
    expect(invalidBody?.data?.messageKey).toBe('error.remoteConfigBaseUrlInvalid');

    // Foreign client rejected
    const bobPut = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
      },
      body: JSON.stringify(validConfig),
    });
    expect(bobPut.status).toBe(404);

    // Response never contains a secret
    expect(updated.apiKey).toBeUndefined();
    expect(updated.secret).toBeUndefined();
  });

  // 2.2 executionMode
  it('2.2 upsert accepts client/server, defaults to client, rejects invalid mode', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Execution Mode Client');

    const putHeaders = {
      'content-type': 'application/json',
      'csrf-token': alice.token,
      cookie: alice.jar.header(),
    };
    const { executionMode: _omitted, ...configWithoutExecutionMode } = validConfig;

    // Omitted executionMode defaults to client
    const defaultRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: putHeaders,
      body: JSON.stringify(configWithoutExecutionMode),
    });
    expect(defaultRes.status).toBe(200);
    expect((await defaultRes.json()).executionMode).toBe('client');

    // Explicit server
    const serverRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: putHeaders,
      body: JSON.stringify({ ...validConfig, executionMode: 'server' }),
    });
    expect(serverRes.status).toBe(200);
    expect((await serverRes.json()).executionMode).toBe('server');

    // Explicit client
    const clientRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: putHeaders,
      body: JSON.stringify({ ...validConfig, executionMode: 'client' }),
    });
    expect(clientRes.status).toBe(200);
    expect((await clientRes.json()).executionMode).toBe('client');

    // Invalid mode rejected
    const invalidRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: putHeaders,
      body: JSON.stringify({ ...validConfig, executionMode: 'tunneled' }),
    });
    expect(invalidRes.status).toBe(422);
    const invalidBody = await invalidRes.json();
    // An invalid enum *value* (not a missing/wrong-typed field) falls back to the
    // generic messageKey, matching the existing systemType enum-invalid behavior.
    expect(invalidBody?.data?.messageKey).toBe('errors.unexpected');
  });

  // 3.6 DELETE
  it('3.6 delete removes owner config; non-owner cannot delete', async () => {
    const alice = await loginAs('alice@example.com', 'secret');
    const bob = await loginAs('bob@example.com', 'secret');
    const client = await createClient(alice.jar, alice.token, 'Delete Client');

    await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify(validConfig),
    });

    // Non-owner cannot delete
    const bobDelete = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'DELETE',
      headers: { 'csrf-token': bob.token, cookie: bob.jar.header() },
    });
    expect(bobDelete.status).toBe(404);

    // Owner deletes
    const delRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'DELETE',
      headers: { 'csrf-token': alice.token, cookie: alice.jar.header() },
    });
    expect(delRes.status).toBe(200);

    // Now not-found for owner too
    const afterRes = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      headers: { cookie: alice.jar.header() },
    });
    expect(afterRes.status).toBe(404);

    // Deleting again → 404
    const again = await fetch(url(`/api/clients/${client.id}/remote-config`), {
      method: 'DELETE',
      headers: { 'csrf-token': alice.token, cookie: alice.jar.header() },
    });
    expect(again.status).toBe(404);
  });
});
