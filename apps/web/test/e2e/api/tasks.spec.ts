import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { CookieJar, primeCsrf } from '../helpers/auth';
import { seedAndLogin } from '../helpers/session';
import { createProject, createTracker, startEntry } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { UNKNOWN_ID } from '../helpers/fixtures';
import type { JsonObject } from '@osi/remote-trackers/contracts';

const describeTasks = requireDocker();

/** Creates a task indirectly via starting/stopping a time entry, since POST /api/tasks was removed. */
async function createTaskViaEntry(
  jar: CookieJar,
  token: string,
  title: string,
  projectId?: string | null,
): Promise<{ id: string; name: string; projectId: string | null }> {
  const body =
    projectId === undefined
      ? { title }
      : {
          title,
          projectId,
        };
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
  body: JsonObject,
): Promise<Response> {
  return fetch(url(`/api/tasks/${id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

describeTasks('tasks API integration', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('list returns own tasks and honors project/search filters', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'List Client ' + Date.now());
    const project = await createProject(jar, token, 'List Project ' + Date.now(), tracker.id);

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

  it('ranks the most recently used task first, overriding alphabetical order', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const suffix = Date.now();

    // Named so alphabetical order would put the older task first; MRU ranking
    // must reverse that.
    const olderRes = await startEntry(jar, token, {
      title: `Aaa Older ${suffix}`,
      startedAt: '2020-01-01T10:00:00.000Z',
      stoppedAt: '2020-01-01T11:00:00.000Z',
    });
    const olderEntry = await olderRes.json();
    const newerRes = await startEntry(jar, token, {
      title: `Zzz Newer ${suffix}`,
      startedAt: '2025-01-01T10:00:00.000Z',
      stoppedAt: '2025-01-01T11:00:00.000Z',
    });
    const newerEntry = await newerRes.json();

    const list = await fetch(url(`/api/tasks?search=${suffix}`), {
      headers: { cookie: jar.header() },
    });
    const rows: { id: string }[] = await list.json();
    const olderIndex = rows.findIndex((r) => r.id === olderEntry.taskId);
    const newerIndex = rows.findIndex((r) => r.id === newerEntry.taskId);
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeGreaterThan(newerIndex);
  });

  it('defaults to a cap of 20 tasks, keeping only the highest-ranked', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const suffix = Date.now();
    const taskIdsOldestFirst: string[] = [];

    for (let i = 0; i < 21; i++) {
      const res = await startEntry(jar, token, {
        title: `Cap${suffix}-${i}`,
        startedAt: new Date(2020, 0, 1 + i, 10).toISOString(),
        stoppedAt: new Date(2020, 0, 1 + i, 11).toISOString(),
      });
      const entry = await res.json();
      taskIdsOldestFirst.push(entry.taskId);
    }

    const list = await fetch(url(`/api/tasks?search=Cap${suffix}`), {
      headers: { cookie: jar.header() },
    });
    const rows: { id: string }[] = await list.json();
    expect(rows).toHaveLength(20);
    // Newest (last created) ranks first; oldest is dropped by the cap.
    expect(rows[0]?.id).toBe(taskIdsOldestFirst[20]);
    expect(rows.map((r) => r.id)).not.toContain(taskIdsOldestFirst[0]);
  });

  it('honors an explicit limit', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const suffix = Date.now();

    for (let i = 0; i < 7; i++) {
      await startEntry(jar, token, {
        title: `Lim${suffix}-${i}`,
        startedAt: new Date(2021, 0, 1 + i, 10).toISOString(),
        stoppedAt: new Date(2021, 0, 1 + i, 11).toISOString(),
      });
    }

    const list = await fetch(url(`/api/tasks?search=Lim${suffix}&limit=5`), {
      headers: { cookie: jar.header() },
    });
    const rows = await list.json();
    expect(rows).toHaveLength(5);
  });

  it('rejects a limit that is not a positive integer within range', async () => {
    const { jar } = await seedAndLogin(dbUrl);

    for (const invalid of ['0', 'abc', '101']) {
      const res = await fetch(url(`/api/tasks?limit=${invalid}`), {
        headers: { cookie: jar.header() },
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body?.data?.messageKey).toBe('error.taskLimitInvalid');
    }
  });

  it('treats a blank search the same as an absent one', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const suffix = Date.now();
    const created = await createTaskViaEntry(jar, token, `Blank Search ${suffix}`);

    const blank = await fetch(url('/api/tasks?search=%20%20'), {
      headers: { cookie: jar.header() },
    });
    const absent = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const blankRows = await blank.json();
    const absentRows = await absent.json();
    expect(blankRows.map((r: { id: string }) => r.id)).toEqual(
      absentRows.map((r: { id: string }) => r.id),
    );
    expect(blankRows.map((r: { id: string }) => r.id)).toContain(created.id);
  });

  it('patch happy path rename and project reassignment when no collision', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Patch T Client ' + Date.now());
    const projectA = await createProject(jar, token, 'Patch T Project A ' + Date.now(), tracker.id);
    const projectB = await createProject(jar, token, 'Patch T Project B ' + Date.now(), tracker.id);

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
    const { jar, token } = await seedAndLogin(dbUrl);
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
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Merge Clear Client ' + Date.now());
    const project = await createProject(
      jar,
      token,
      'Merge Clear Project ' + Date.now(),
      tracker.id,
    );
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

  it('patch with name only keeps the current project (no silent unassign)', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Name Only Client ' + Date.now());
    const project = await createProject(jar, token, 'Name Only Project ' + Date.now(), tracker.id);

    const created = await createTaskViaEntry(jar, token, 'Rename Me ' + Date.now(), project.id);

    const patchRes = await patchTask(jar, token, created.id, { name: 'Renamed ' + Date.now() });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.projectId).toBe(project.id);
  });

  it('patch with projectId: null explicitly clears the project', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Clear Client ' + Date.now());
    const project = await createProject(jar, token, 'Clear Project ' + Date.now(), tracker.id);
    const suffix = Date.now();

    const created = await createTaskViaEntry(jar, token, `Clear Me ${suffix}`, project.id);

    const patchRes = await patchTask(jar, token, created.id, {
      name: `Clear Me ${suffix}`,
      projectId: null,
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.projectId).toBeNull();
  });

  it('patch with an owned projectId sets the project (ownership validated)', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, 'Set Client ' + Date.now());
    const project = await createProject(jar, token, 'Set Project ' + Date.now(), tracker.id);
    const suffix = Date.now();

    const created = await createTaskViaEntry(jar, token, `Set Me ${suffix}`);

    const patchRes = await patchTask(jar, token, created.id, {
      name: `Set Me ${suffix}`,
      projectId: project.id,
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.projectId).toBe(project.id);
  });

  it('patch on unknown/foreign id → 404', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const bobTask = await createTaskViaEntry(bob.jar, bob.token, 'Bob Task ' + Date.now());

    const fakeId = UNKNOWN_ID;
    const notFound = await patchTask(alice.jar, alice.token, fakeId, { name: 'Ghost' });
    expect(notFound.status).toBe(404);

    const foreign = await patchTask(alice.jar, alice.token, bobTask.id, { name: 'Hijacked' });
    expect(foreign.status).toBe(404);
  });

  it('removed routes: POST /api/tasks and DELETE /api/tasks/[id] no longer exist', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);

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
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);

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
