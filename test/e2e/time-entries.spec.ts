import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeTimeEntries = requireDocker();

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

async function startEntry(
  jar: CookieJar,
  token: string,
  body: Record<string, unknown> = {},
): Promise<Response> {
  return fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

async function patchEntry(
  jar: CookieJar,
  token: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url(`/api/time-entries/${id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

async function getRunning(jar: CookieJar): Promise<Response> {
  return fetch(url('/api/time-entries/running'), { headers: { cookie: jar.header() } });
}

describeTimeEntries('time-entries API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'talice@example.com', displayName: 'Alice' },
    { email: 'tbob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  it('4.6a starts a running entry with a title and project, and matches it via resolved task', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'TE Client ' + Date.now());
    const project = await createProject(jar, token, 'TE Project ' + Date.now(), client.id);

    const res = await startEntry(jar, token, { title: 'Working on it', projectId: project.id });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.taskName).toBe('Working on it');
    expect(created.projectId).toBe(project.id);
    expect(created.projectName).toBe(project.name);
    expect(created.clientName).toBe(client.name);
    expect(created.stoppedAt).toBeNull();
    expect(created.startedAt).toBeDefined();

    // Cleanup: stop it so it doesn't leak into other tests
    await patchEntry(jar, token, created.id, { stoppedAt: new Date().toISOString() });
  });

  it('4.6b starts an untitled entry with no task', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const res = await startEntry(jar, token, {});
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.taskId).toBeNull();
    expect(created.taskName).toBeNull();

    await patchEntry(jar, token, created.id, { stoppedAt: new Date().toISOString() });
  });

  it('4.6c invalid projectId is rejected with 422', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const res = await startEntry(jar, token, { title: 'Bad Project', projectId: 'not-a-uuid' });
    expect(res.status).toBe(422);
    expect((await res.json())?.data?.messageKey).toBe('error.timeEntryProjectInvalid');
  });

  it('4.6d starting a new timer while one is running stops the old one (single-running invariant)', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const first = await (await startEntry(jar, token, { title: 'First' })).json();
    const runningAfterFirst = await (await getRunning(jar)).json();
    expect(runningAfterFirst.id).toBe(first.id);

    const second = await (await startEntry(jar, token, { title: 'Second' })).json();
    expect(second.id).not.toBe(first.id);

    const runningNow = await (await getRunning(jar)).json();
    expect(runningNow.id).toBe(second.id);

    // Cleanup
    await patchEntry(jar, token, second.id, { stoppedAt: new Date().toISOString() });
  });

  it('4.6e stop happy path, retitle re-resolves task, and stop-before-start is rejected', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const created = await (await startEntry(jar, token, { title: 'Retitle Me' })).json();

    // stop-before-start rejected
    const before = new Date(new Date(created.startedAt).getTime() - 10_000).toISOString();
    const badStop = await patchEntry(jar, token, created.id, { stoppedAt: before });
    expect(badStop.status).toBe(422);
    expect((await badStop.json())?.data?.messageKey).toBe('error.timeEntryStoppedBeforeStarted');

    // retitle re-resolves task
    const retitled = await patchEntry(jar, token, created.id, { title: 'New Title' });
    expect(retitled.status).toBe(200);
    const retitledBody = await retitled.json();
    expect(retitledBody.taskName).toBe('New Title');

    // stop happy path
    const stopRes = await patchEntry(jar, token, created.id, {
      stoppedAt: new Date().toISOString(),
    });
    expect(stopRes.status).toBe(200);
    const stopped = await stopRes.json();
    expect(stopped.stoppedAt).not.toBeNull();

    const runningNow = await (await getRunning(jar)).json();
    expect(runningNow).toBeNull();
  });

  it('4.6f foreign/unknown id → 404', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');
    const bobEntry = await (await startEntry(bob.jar, bob.token, { title: 'Bob Entry' })).json();

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const unknownRes = await patchEntry(alice.jar, alice.token, fakeId, {
      stoppedAt: new Date().toISOString(),
    });
    expect(unknownRes.status).toBe(404);

    const foreignRes = await patchEntry(alice.jar, alice.token, bobEntry.id, {
      stoppedAt: new Date().toISOString(),
    });
    expect(foreignRes.status).toBe(404);

    await patchEntry(bob.jar, bob.token, bobEntry.id, { stoppedAt: new Date().toISOString() });
  });

  it('4.6g GET running returns null when nothing is running', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    // Ensure no running entry
    const running = await (await getRunning(jar)).json();
    if (running) {
      await patchEntry(jar, token, running.id, { stoppedAt: new Date().toISOString() });
    }
    const res = await getRunning(jar);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('4.6h 401 unauthenticated for start/stop/running', async () => {
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);

    expect((await startEntry(anonJar, anonToken, { title: 'Nope' })).status).toBe(401);
    expect(
      (
        await patchEntry(anonJar, anonToken, '00000000-0000-0000-0000-000000000000', {
          stoppedAt: new Date().toISOString(),
        })
      ).status,
    ).toBe(401);
    expect((await getRunning(anonJar)).status).toBe(401);
  });
});
