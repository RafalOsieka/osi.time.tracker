import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeTasks = requireDocker();

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

async function createProject(
  jar: CookieJar,
  token: string,
  name: string,
  clientId: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(url('/api/projects'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name, clientId }),
  });
  return res.json();
}

/** Creates a task indirectly via starting/stopping a time entry, since POST /api/tasks was removed. */
async function createTaskViaEntry(
  jar: CookieJar,
  token: string,
  title: string,
  projectId?: string | null,
): Promise<{ id: string; name: string; projectId: string | null }> {
  const body: Record<string, unknown> = { title };
  if (projectId !== undefined) body.projectId = projectId;
  const startRes = await fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
  const entry = await startRes.json();
  await fetch(url(`/api/time-entries/${entry.id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
  });

  const tasksRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
  const rows: { id: string; name: string; projectId: string | null }[] = await tasksRes.json();
  const found = rows.find((r) => r.id === entry.taskId);
  if (!found) throw new Error('task not found after creating via time entry');
  return found;
}

async function patchTask(
  jar: CookieJar,
  token: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url(`/api/tasks/${id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

describeTasks('tasks API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'talice@example.com', displayName: 'Alice' },
    { email: 'tbob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  it('list returns own tasks ordered by name and honors project/search filters', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'List Client ' + Date.now());
    const project = await createProject(jar, token, 'List Project ' + Date.now(), client.id);

    const t1 = await createTaskViaEntry(jar, token, 'Alpha Task', project.id);
    const t2 = await createTaskViaEntry(jar, token, 'Beta Task');

    const list = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows = await list.json();
    expect(rows.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([t1.id, t2.id]));

    const filtered = await fetch(url(`/api/tasks?projectId=${project.id}`), {
      headers: { cookie: jar.header() },
    });
    const filteredRows = await filtered.json();
    expect(filteredRows.map((r: { id: string }) => r.id)).toContain(t1.id);

    const noneFiltered = await fetch(url('/api/tasks?projectId=none'), {
      headers: { cookie: jar.header() },
    });
    const noneRows = await noneFiltered.json();
    expect(noneRows.map((r: { id: string }) => r.id)).toContain(t2.id);

    const searchRes = await fetch(url('/api/tasks?search=alp'), {
      headers: { cookie: jar.header() },
    });
    const searchRows = await searchRes.json();
    expect(searchRows.map((r: { id: string }) => r.id)).toContain(t1.id);
  });

  it('patch happy path rename and project reassignment when no collision', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'Patch T Client ' + Date.now());
    const projectA = await createProject(jar, token, 'Patch T Project A ' + Date.now(), client.id);
    const projectB = await createProject(jar, token, 'Patch T Project B ' + Date.now(), client.id);

    const created = await createTaskViaEntry(jar, token, 'Patch Me ' + Date.now(), projectA.id);

    const patchRes = await patchTask(jar, token, created.id, {
      name: 'Patched Name ' + Date.now(),
      projectId: projectB.id,
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.projectId).toBe(projectB.id);
    expect(patched.id).toBe(created.id);
  });

  it('patch merges onto an existing colliding task, re-pointing entries and removing the loser row', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const suffix = Date.now();
    const survivor = await createTaskViaEntry(jar, token, `Survivor ${suffix}`);
    const loser = await createTaskViaEntry(jar, token, `Loser ${suffix}`);

    // Rename loser onto survivor's name/scope (both project-less) → merge
    const patchRes = await patchTask(jar, token, loser.id, { name: survivor.name });
    expect(patchRes.status).toBe(200);
    const merged = await patchRes.json();
    expect(merged.id).toBe(survivor.id);

    // Loser row is hard-deleted
    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === loser.id)).toBeUndefined();

    // Any time entries that referenced the loser now reference the survivor
    const running = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    expect(await running.json()).toBeNull();
  });

  it('patch merges when clearing project onto an existing project-less task', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'Merge Clear Client ' + Date.now());
    const project = await createProject(jar, token, 'Merge Clear Project ' + Date.now(), client.id);
    const suffix = Date.now();

    const projectLess = await createTaskViaEntry(jar, token, `Shared ${suffix}`);
    const scoped = await createTaskViaEntry(jar, token, `Shared ${suffix}`, project.id);

    // Clearing scoped task's project (and keeping the same name) collides with the project-less task
    const patchRes = await patchTask(jar, token, scoped.id, {
      name: `Shared ${suffix}`,
      projectId: null,
    });
    expect(patchRes.status).toBe(200);
    const merged = await patchRes.json();
    expect(merged.id).toBe(projectLess.id);

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === scoped.id)).toBeUndefined();
  });

  it('patch on unknown/foreign id → 404', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');
    const bobTask = await createTaskViaEntry(bob.jar, bob.token, 'Bob Task ' + Date.now());

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await patchTask(alice.jar, alice.token, fakeId, { name: 'Ghost' });
    expect(notFound.status).toBe(404);

    const foreign = await patchTask(alice.jar, alice.token, bobTask.id, { name: 'Hijacked' });
    expect(foreign.status).toBe(404);
  });

  it('removed routes: POST /api/tasks and DELETE /api/tasks/[id] no longer exist', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');

    const postRes = await fetch(url('/api/tasks'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Should Not Work' }),
    });
    expect([404, 405]).toContain(postRes.status);

    const task = await createTaskViaEntry(jar, token, 'Undeletable ' + Date.now());
    const deleteRes = await fetch(url(`/api/tasks/${task.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect([404, 405]).toContain(deleteRes.status);
  });

  it('cross-user isolation, unauthenticated 401, and missing CSRF rejection', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');

    const aliceTask = await createTaskViaEntry(alice.jar, alice.token, 'Alice Only ' + Date.now());

    const bobList = await fetch(url('/api/tasks'), { headers: { cookie: bob.jar.header() } });
    const bobRows = await bobList.json();
    expect(bobRows.find((r: { id: string }) => r.id === aliceTask.id)).toBeUndefined();

    const bobPatch = await patchTask(bob.jar, bob.token, aliceTask.id, { name: 'Hijacked' });
    expect(bobPatch.status).toBe(404);

    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    expect((await fetch(url('/api/tasks'))).status).toBe(401);
    expect((await patchTask(anonJar, anonToken, aliceTask.id, { name: 'Nope' })).status).toBe(401);

    const noCsrfPatch = await fetch(url(`/api/tasks/${aliceTask.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: alice.jar.header() },
      body: JSON.stringify({ name: 'No CSRF' }),
    });
    expect(noCsrfPatch.status).toBeGreaterThanOrEqual(400);
  });
});
