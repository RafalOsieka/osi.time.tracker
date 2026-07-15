import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeSyncDay = requireDocker();

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

async function createClient(jar: CookieJar, token: string, name: string) {
  const res = await fetch(url('/api/clients'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

async function createProject(jar: CookieJar, token: string, name: string, clientId: string) {
  const res = await fetch(url('/api/projects'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name, clientId }),
  });
  return res.json();
}

async function createEntry(
  jar: CookieJar,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

async function setTimezone(jar: CookieJar, token: string, timezone: string): Promise<void> {
  await fetch(url('/api/user/settings'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ timezone }),
  });
}

async function putRemoteConfig(
  jar: CookieJar,
  token: string,
  clientId: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(url(`/api/clients/${clientId}/remote-config`), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getDay(jar: CookieJar, date: string): Promise<Response> {
  return fetch(url(`/api/sync/day?date=${encodeURIComponent(date)}`), {
    headers: { cookie: jar.header() },
  });
}

describeSyncDay('sync day-review API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'salice@example.com', displayName: 'Alice' },
    { email: 'sbob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  it('returns one row per task with config/link state, plus the untitled bucket', async () => {
    const { jar, token } = await loginAs('salice@example.com', 'secret');
    await setTimezone(jar, token, 'UTC');
    const client = await createClient(jar, token, 'Sync Client ' + Date.now());
    const project = await createProject(jar, token, 'Sync Project ' + Date.now(), client.id);
    await putRemoteConfig(jar, token, client.id, {
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      executionMode: 'client',
      transportMode: 'direct',
      roundingRule: 'none',
    });

    const date = '2026-03-15';
    const startedAt = `${date}T10:00:00.000Z`;
    const stoppedAt = `${date}T10:30:00.000Z`;
    await createEntry(jar, token, {
      title: 'Manageable Task ' + Date.now(),
      projectId: project.id,
      startedAt,
      stoppedAt,
    });
    await createEntry(jar, token, { startedAt, stoppedAt });

    const res = await getDay(jar, date);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe(date);
    expect(body.untitledTotalSeconds).toBeGreaterThanOrEqual(30 * 60);
    const row = body.rows.find((r: { totalSeconds: number }) => r.totalSeconds === 30 * 60);
    expect(row).toBeDefined();
    expect(row.config).not.toBeNull();
    expect(row.config.systemType).toBe('openproject');
  });

  it('does not include another user data (foreign-user isolation)', async () => {
    const alice = await loginAs('salice@example.com', 'secret');
    const bob = await loginAs('sbob@example.com', 'secret');
    await setTimezone(bob.jar, bob.token, 'UTC');

    const date = '2026-03-16';
    const startedAt = `${date}T09:00:00.000Z`;
    const stoppedAt = `${date}T09:15:00.000Z`;
    await createEntry(bob.jar, bob.token, { title: 'Bob Only', startedAt, stoppedAt });

    const res = await getDay(alice.jar, date);
    const body = await res.json();
    expect(body.rows.find((r: { taskName: string }) => r.taskName === 'Bob Only')).toBeUndefined();
  });

  it('rejects an invalid or missing date with 422', async () => {
    const { jar } = await loginAs('salice@example.com', 'secret');

    const missing = await fetch(url('/api/sync/day'), { headers: { cookie: jar.header() } });
    expect(missing.status).toBe(422);
    expect((await missing.json())?.data?.messageKey).toBe('error.remoteSyncDateRequired');

    const invalid = await getDay(jar, 'not-a-date');
    expect(invalid.status).toBe(422);
    expect((await invalid.json())?.data?.messageKey).toBe('error.remoteSyncDateInvalid');
  });

  it('attributes a cross-midnight entry to the correct day in the user timezone', async () => {
    const { jar, token } = await loginAs('salice@example.com', 'secret');
    await setTimezone(jar, token, 'Pacific/Auckland'); // UTC+13 (DST) in March

    // 23:30 UTC on the 16th is already the 17th in Pacific/Auckland.
    const startedAt = '2026-03-16T23:30:00.000Z';
    const stoppedAt = '2026-03-16T23:45:00.000Z';
    const title = 'Cross Midnight ' + Date.now();
    await createEntry(jar, token, { title, startedAt, stoppedAt });

    const day16 = await (await getDay(jar, '2026-03-16')).json();
    expect(day16.rows.find((r: { taskName: string }) => r.taskName === title)).toBeUndefined();

    const day17 = await (await getDay(jar, '2026-03-17')).json();
    expect(day17.rows.find((r: { taskName: string }) => r.taskName === title)).toBeDefined();
  });

  it('surfaces no-config, no-project (untitled), and unlinked rows distinctly', async () => {
    const { jar, token } = await loginAs('salice@example.com', 'secret');
    await setTimezone(jar, token, 'UTC');
    const client = await createClient(jar, token, 'No Config Client ' + Date.now());
    const project = await createProject(jar, token, 'No Config Project ' + Date.now(), client.id);

    const date = '2026-03-18';
    const startedAt = `${date}T08:00:00.000Z`;
    const stoppedAt = `${date}T08:20:00.000Z`;
    const title = 'No Config Task ' + Date.now();
    await createEntry(jar, token, { title, projectId: project.id, startedAt, stoppedAt });

    const body = await (await getDay(jar, date)).json();
    const row = body.rows.find((r: { taskName: string }) => r.taskName === title);
    expect(row).toBeDefined();
    expect(row.config).toBeNull();
  });

  it('requires authentication', async () => {
    const anonJar = new CookieJar();
    const res = await getDay(anonJar, '2026-03-15');
    expect(res.status).toBe(401);
  });
});
