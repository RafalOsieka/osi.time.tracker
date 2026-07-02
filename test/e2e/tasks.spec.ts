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

async function createTask(jar: CookieJar, token: string, name: string, projectId?: string | null) {
  const body: Record<string, unknown> = { name };
  if (projectId !== undefined) body.projectId = projectId;
  const res = await fetch(url('/api/tasks'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
  return res;
}

describeTasks('tasks API integration', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'talice@example.com', displayName: 'Alice' },
    { email: 'tbob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  // 3.2 list: own-only isolation, soft-deleted exclusion, number ordering, resolved names,
  // projectId filter, foreign/unknown projectId, project-less, projectId=none sentinel
  it('3.2 list returns own non-deleted tasks ordered by number and honors project filters', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'List Client ' + Date.now());
    const project = await createProject(jar, token, 'List Project ' + Date.now(), client.id);

    const empty = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    const t1 = await (await createTask(jar, token, 'Task One', project.id)).json();
    const t2 = await (await createTask(jar, token, 'Task Two')).json();

    const list = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows = await list.json();
    expect(rows).toHaveLength(2);
    expect(rows[0].number).toBe(t1.number);
    expect(rows[1].number).toBe(t2.number);
    expect(rows[0].projectName).toBe(project.name);
    expect(rows[0].clientName).toBe(client.name);
    expect(rows[1].projectId).toBeNull();
    expect(rows[1].projectName).toBeNull();
    expect(rows[1].clientName).toBeNull();

    // Filter by projectId
    const filtered = await fetch(url(`/api/tasks?projectId=${project.id}`), {
      headers: { cookie: jar.header() },
    });
    const filteredRows = await filtered.json();
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].id).toBe(t1.id);

    // projectId=none sentinel: project-less tasks only
    const noneFiltered = await fetch(url('/api/tasks?projectId=none'), {
      headers: { cookie: jar.header() },
    });
    const noneRows = await noneFiltered.json();
    expect(noneRows).toHaveLength(1);
    expect(noneRows[0].id).toBe(t2.id);

    // Foreign/unknown projectId → empty list
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const foreignFiltered = await fetch(url(`/api/tasks?projectId=${fakeId}`), {
      headers: { cookie: jar.header() },
    });
    expect(await foreignFiltered.json()).toEqual([]);

    // Soft-delete t1 and verify it's excluded from the list
    const delRes = await fetch(url(`/api/tasks/${t1.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const afterDelete = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const afterRows = await afterDelete.json();
    expect(afterRows).toHaveLength(1);
    expect(afterRows[0].id).toBe(t2.id);
  });

  it('3.2b resolved names persist after the parent project is soft-deleted', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'Persist Client ' + Date.now());
    const project = await createProject(jar, token, 'Persist Project ' + Date.now(), client.id);
    const task = await (await createTask(jar, token, 'Persist Task', project.id)).json();

    await fetch(url(`/api/projects/${project.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    const found = rows.find((r: { id: string }) => r.id === task.id);
    expect(found).toBeDefined();
    expect(found.projectName).toBe(project.name);
    expect(found.clientName).toBe(client.name);
  });

  // 3.4 create: happy path, project-less, empty-name rejection, invalid projectId,
  // foreign/unknown projectId → 404, duplicate names allowed, numbering per user
  it('3.4 create happy path, project-less, validation, and numbering', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'Create Client ' + Date.now());
    const project = await createProject(jar, token, 'Create Project ' + Date.now(), client.id);

    // Happy path with project
    const res = await createTask(jar, token, 'New Task', project.id);
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.name).toBe('New Task');
    expect(created.projectId).toBe(project.id);
    expect(created.projectName).toBe(project.name);
    expect(created.clientName).toBe(client.name);
    expect(created.id).toBeDefined();
    expect(created.number).toBeGreaterThanOrEqual(1);
    const firstNumber = created.number;

    // Project-less creation
    const looseRes = await createTask(jar, token, 'Loose Task');
    expect(looseRes.status).toBe(200);
    const loose = await looseRes.json();
    expect(loose.projectId).toBeNull();
    expect(loose.projectName).toBeNull();
    expect(loose.clientName).toBeNull();
    expect(loose.number).toBe(firstNumber + 1);

    // Numbers increase monotonically per user
    const thirdRes = await createTask(jar, token, 'Third Task');
    const third = await thirdRes.json();
    expect(third.number).toBe(firstNumber + 2);

    // Empty name rejected
    const emptyRes = await createTask(jar, token, '');
    expect(emptyRes.status).toBe(422);
    expect((await emptyRes.json())?.data?.messageKey).toBe('error.taskNameRequired');

    // Invalid projectId rejected
    const invalidRes = await createTask(jar, token, 'Bad Project', 'not-a-uuid');
    expect(invalidRes.status).toBe(422);
    expect((await invalidRes.json())?.data?.messageKey).toBe('error.taskProjectInvalid');

    // Foreign/unknown projectId → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const unknownRes = await createTask(jar, token, 'Ghost Task', fakeId);
    expect(unknownRes.status).toBe(404);

    // Duplicate names allowed
    const dupRes = await createTask(jar, token, 'New Task', project.id);
    expect(dupRes.status).toBe(200);
    const dup = await dupRes.json();
    expect(dup.name).toBe('New Task');
    expect(dup.id).not.toBe(created.id);
  });

  it('3.4b foreign projectId (owned by another user) → 404', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');
    const bobClient = await createClient(bob.jar, bob.token, 'Bob T Client ' + Date.now());
    const bobProject = await createProject(
      bob.jar,
      bob.token,
      'Bob T Project ' + Date.now(),
      bobClient.id,
    );

    const res = await createTask(alice.jar, alice.token, 'Cross User', bobProject.id);
    expect(res.status).toBe(404);
  });

  it('3.4c per-user numbering isolation and soft-deleted numbers not reused', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');

    const aliceFirst = await (await createTask(alice.jar, alice.token, 'Alice First')).json();
    const bobFirst = await (await createTask(bob.jar, bob.token, 'Bob First')).json();
    expect(bobFirst.number).toBeGreaterThanOrEqual(1);
    // Independent per-user counters: creating for Bob doesn't affect Alice's next number.
    const aliceSecond = await (await createTask(alice.jar, alice.token, 'Alice Second')).json();
    expect(aliceSecond.number).toBe(aliceFirst.number + 1);

    // Soft-delete alice's second task, then create another: number should not be reused.
    await fetch(url(`/api/tasks/${aliceSecond.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': alice.token, cookie: alice.jar.header() },
    });
    const aliceThird = await (await createTask(alice.jar, alice.token, 'Alice Third')).json();
    expect(aliceThird.number).toBe(aliceSecond.number + 1);
  });

  // 3.6 patch: happy path, duplicate allowed, number unchanged, foreign id → 404,
  // unchanged project not re-validated, rename allowed under soft-deleted project,
  // clearing to null, assigning a project to a project-less task
  it('3.6 patch happy path, immutable number, and project reassignment rules', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'Patch T Client ' + Date.now());
    const projectA = await createProject(jar, token, 'Patch T Project A ' + Date.now(), client.id);
    const projectB = await createProject(jar, token, 'Patch T Project B ' + Date.now(), client.id);

    const created = await (await createTask(jar, token, 'Patch Me', projectA.id)).json();
    const originalNumber = created.number;

    // Happy path rename + project change
    const patchRes = await fetch(url(`/api/tasks/${created.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patched Name', projectId: projectB.id }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Patched Name');
    expect(patched.projectId).toBe(projectB.id);
    expect(patched.number).toBe(originalNumber);

    // Duplicate name allowed
    const other = await (await createTask(jar, token, 'Other Task')).json();
    const dupPatch = await fetch(url(`/api/tasks/${other.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Patched Name' }),
    });
    expect(dupPatch.status).toBe(200);
    expect((await dupPatch.json()).name).toBe('Patched Name');

    // Foreign/unknown id → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await fetch(url(`/api/tasks/${fakeId}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    expect(notFound.status).toBe(404);

    // Assign a project to a project-less task
    const assignRes = await fetch(url(`/api/tasks/${other.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Now With Project', projectId: projectA.id }),
    });
    expect(assignRes.status).toBe(200);
    const assigned = await assignRes.json();
    expect(assigned.projectId).toBe(projectA.id);

    // Clear the project to null
    const clearRes = await fetch(url(`/api/tasks/${assigned.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Now Project-less', projectId: null }),
    });
    expect(clearRes.status).toBe(200);
    const cleared = await clearRes.json();
    expect(cleared.projectId).toBeNull();
    expect(cleared.projectName).toBeNull();
  });

  it('3.6b rename allowed under a soft-deleted project (unchanged projectId not re-validated)', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'Soft Del T Client ' + Date.now());
    const project = await createProject(jar, token, 'Soft Del T Project ' + Date.now(), client.id);
    const task = await (await createTask(jar, token, 'Original Name', project.id)).json();

    const delRes = await fetch(url(`/api/projects/${project.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const patchRes = await fetch(url(`/api/tasks/${task.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Renamed Name', projectId: project.id }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.name).toBe('Renamed Name');
    expect(patched.projectId).toBe(project.id);
    expect(patched.projectName).toBe(project.name);
  });

  it('3.6c patching to a foreign or unknown projectId → 404', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');
    const bobClient = await createClient(bob.jar, bob.token, 'Bob T Patch Client ' + Date.now());
    const bobProject = await createProject(
      bob.jar,
      bob.token,
      'Bob T Patch Project ' + Date.now(),
      bobClient.id,
    );

    const task = await (await createTask(alice.jar, alice.token, 'Alice Task')).json();
    const patchRes = await fetch(url(`/api/tasks/${task.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': alice.token,
        cookie: alice.jar.header(),
      },
      body: JSON.stringify({ name: 'Alice Task', projectId: bobProject.id }),
    });
    expect(patchRes.status).toBe(404);
  });

  // 3.8 delete: successful soft-delete retains the row and removes it from the list,
  // and foreign/unknown id → 404
  it('3.8 delete soft-deletes and excludes from list + foreign id → 404', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const task = await (await createTask(jar, token, 'Delete Me')).json();

    const delRes = await fetch(url(`/api/tasks/${task.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(delRes.status).toBe(200);

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows = await listRes.json();
    expect(rows.find((r: { id: string }) => r.id === task.id)).toBeUndefined();

    // Deleting again (already soft-deleted) → 404
    const again = await fetch(url(`/api/tasks/${task.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(again.status).toBe(404);

    // Foreign id → 404
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await fetch(url(`/api/tasks/${fakeId}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect(notFound.status).toBe(404);
  });

  // 3.9 cross-user isolation + unauthenticated (401) + missing CSRF on mutating endpoints
  it('3.9 cross-user isolation, unauthenticated 401, and missing CSRF rejection', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');

    const aliceTask = await (await createTask(alice.jar, alice.token, 'Alice Only')).json();

    // Bob cannot see Alice's task in his list
    const bobList = await fetch(url('/api/tasks'), { headers: { cookie: bob.jar.header() } });
    const bobRows = await bobList.json();
    expect(bobRows.find((r: { id: string }) => r.id === aliceTask.id)).toBeUndefined();

    // Bob cannot patch Alice's task → 404
    const bobPatch = await fetch(url(`/api/tasks/${aliceTask.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': bob.token,
        cookie: bob.jar.header(),
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(bobPatch.status).toBe(404);

    // Bob cannot delete Alice's task → 404
    const bobDelete = await fetch(url(`/api/tasks/${aliceTask.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': bob.token, cookie: bob.jar.header() },
    });
    expect(bobDelete.status).toBe(404);

    // Unauthenticated → 401 on every endpoint. Mutating requests must still carry
    // a valid CSRF token/cookie pair (unrelated to the session) so the CSRF
    // middleware, which runs before the auth check, doesn't short-circuit with 403.
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    expect((await fetch(url('/api/tasks'))).status).toBe(401);
    expect(
      (
        await fetch(url('/api/tasks'), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'csrf-token': anonToken,
            cookie: anonJar.header(),
          },
          body: JSON.stringify({ name: 'Nope' }),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(url(`/api/tasks/${aliceTask.id}`), {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'csrf-token': anonToken,
            cookie: anonJar.header(),
          },
          body: JSON.stringify({ name: 'Nope' }),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(url(`/api/tasks/${aliceTask.id}`), {
          method: 'DELETE',
          headers: { 'csrf-token': anonToken, cookie: anonJar.header() },
        })
      ).status,
    ).toBe(401);

    // Missing CSRF token on mutating endpoints → rejected
    const noCsrfCreate = await fetch(url('/api/tasks'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: alice.jar.header() },
      body: JSON.stringify({ name: 'No CSRF' }),
    });
    expect(noCsrfCreate.status).toBeGreaterThanOrEqual(400);

    const noCsrfDelete = await fetch(url(`/api/tasks/${aliceTask.id}`), {
      method: 'DELETE',
      headers: { cookie: alice.jar.header() },
    });
    expect(noCsrfDelete.status).toBeGreaterThanOrEqual(400);
  });
});
