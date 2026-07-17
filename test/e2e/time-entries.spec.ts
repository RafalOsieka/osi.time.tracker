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

async function deleteEntry(jar: CookieJar, token: string, id: string): Promise<Response> {
  return fetch(url(`/api/time-entries/${id}`), {
    method: 'DELETE',
    headers: { 'csrf-token': token, cookie: jar.header() },
  });
}

async function listEntries(jar: CookieJar, from: string, to: string): Promise<Response> {
  return fetch(
    url(`/api/time-entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    {
      headers: { cookie: jar.header() },
    },
  );
}

async function bulkAssign(
  jar: CookieJar,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url('/api/time-entries/bulk-assign'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
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

  it('list filters by range, orders DESC, includes running entries and resolved names', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'List TE Client ' + Date.now());
    const project = await createProject(jar, token, 'List TE Project ' + Date.now(), client.id);

    const first = await (
      await startEntry(jar, token, { title: 'List Entry 1', projectId: project.id })
    ).json();
    await patchEntry(jar, token, first.id, { stoppedAt: new Date().toISOString() });

    const second = await (await startEntry(jar, token, { title: 'List Entry 2' })).json();

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await listEntries(jar, from, to);
    expect(res.status).toBe(200);
    const rows = await res.json();
    const ids = rows.map((r: { id: string }) => r.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));

    const found1 = rows.find((r: { id: string }) => r.id === first.id);
    expect(found1.taskName).toBe('List Entry 1');
    expect(found1.projectName).toBe(project.name);
    expect(found1.clientName).toBe(client.name);

    const foundRunning = rows.find((r: { id: string }) => r.id === second.id);
    expect(foundRunning.stoppedAt).toBeNull();

    // Range excluding both entries → empty
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const pastEnd = new Date(Date.now() - 1_800_000).toISOString();
    const emptyRes = await listEntries(jar, past, pastEnd);
    const emptyRows = await emptyRes.json();
    expect(emptyRows.find((r: { id: string }) => r.id === first.id)).toBeUndefined();

    await patchEntry(jar, token, second.id, { stoppedAt: new Date().toISOString() });
  });

  it('list rejects an invalid/missing range with a messageKey', async () => {
    const { jar } = await loginAs('talice@example.com', 'secret');

    const missing = await fetch(url('/api/time-entries'), { headers: { cookie: jar.header() } });
    expect(missing.status).toBe(422);
    expect((await missing.json())?.data?.messageKey).toBe('error.timeEntryRangeInvalid');

    const now = new Date().toISOString();
    const inverted = await listEntries(jar, now, new Date(Date.now() - 1000).toISOString());
    expect(inverted.status).toBe(422);
    expect((await inverted.json())?.data?.messageKey).toBe('error.timeEntryRangeInvalid');
  });

  it('list only returns the authenticated user own entries', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');

    const bobEntry = await (
      await startEntry(bob.jar, bob.token, { title: 'Bob List Entry' })
    ).json();

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const aliceRows = await (await listEntries(alice.jar, from, to)).json();
    expect(aliceRows.find((r: { id: string }) => r.id === bobEntry.id)).toBeUndefined();

    await patchEntry(bob.jar, bob.token, bobEntry.id, { stoppedAt: new Date().toISOString() });
  });

  it('bulk-assign happy path titles all listed untitled entries with a single resolved task', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const e1 = await (await startEntry(jar, token, {})).json();
    await patchEntry(jar, token, e1.id, { stoppedAt: new Date().toISOString() });
    const e2 = await (await startEntry(jar, token, {})).json();
    await patchEntry(jar, token, e2.id, { stoppedAt: new Date().toISOString() });

    const title = 'Bulk Titled ' + Date.now();
    const res = await bulkAssign(jar, token, { ids: [e1.id, e2.id], title });
    expect(res.status).toBe(200);

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const rows = await (await listEntries(jar, from, to)).json();
    const found1 = rows.find((r: { id: string }) => r.id === e1.id);
    const found2 = rows.find((r: { id: string }) => r.id === e2.id);
    expect(found1.taskName).toBe(title);
    expect(found2.taskName).toBe(title);
    expect(found1.taskId).toBe(found2.taskId);
  });

  it('bulk-assign is atomic: a foreign, unknown, or already-titled id rolls back the whole request', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');

    const untitled = await (await startEntry(alice.jar, alice.token, {})).json();
    await patchEntry(alice.jar, alice.token, untitled.id, {
      stoppedAt: new Date().toISOString(),
    });

    const alreadyTitled = await (
      await startEntry(alice.jar, alice.token, { title: 'Already Titled' })
    ).json();
    await patchEntry(alice.jar, alice.token, alreadyTitled.id, {
      stoppedAt: new Date().toISOString(),
    });

    const bobEntry = await (await startEntry(bob.jar, bob.token, {})).json();
    await patchEntry(bob.jar, bob.token, bobEntry.id, { stoppedAt: new Date().toISOString() });

    // Foreign id
    const foreignRes = await bulkAssign(alice.jar, alice.token, {
      ids: [untitled.id, bobEntry.id],
      title: 'Should Not Apply',
    });
    expect(foreignRes.status).toBeGreaterThanOrEqual(400);

    // Unknown id
    const unknownRes = await bulkAssign(alice.jar, alice.token, {
      ids: [untitled.id, '00000000-0000-0000-0000-000000000000'],
      title: 'Should Not Apply',
    });
    expect(unknownRes.status).toBeGreaterThanOrEqual(400);

    // Already-titled id
    const titledRes = await bulkAssign(alice.jar, alice.token, {
      ids: [untitled.id, alreadyTitled.id],
      title: 'Should Not Apply',
    });
    expect(titledRes.status).toBeGreaterThanOrEqual(400);

    // No partial writes: `untitled` must still be untitled after all failed attempts
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const rows = await (await listEntries(alice.jar, from, to)).json();
    const found = rows.find((r: { id: string }) => r.id === untitled.id);
    expect(found.taskId).toBeNull();
  });

  it('bulk-assign rejects an empty ids array or empty title', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const entry = await (await startEntry(jar, token, {})).json();
    await patchEntry(jar, token, entry.id, { stoppedAt: new Date().toISOString() });

    const emptyIds = await bulkAssign(jar, token, { ids: [], title: 'Title' });
    expect(emptyIds.status).toBe(422);

    const emptyTitle = await bulkAssign(jar, token, { ids: [entry.id], title: '' });
    expect(emptyTitle.status).toBe(422);
  });

  it('bulk-assign requires auth and CSRF', async () => {
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);

    expect((await bulkAssign(anonJar, anonToken, { ids: [], title: 'Nope' })).status).toBe(401);

    const { jar } = await loginAs('talice@example.com', 'secret');
    const noCsrfRes = await fetch(url('/api/time-entries/bulk-assign'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: jar.header() },
      body: JSON.stringify({ ids: [], title: 'Nope' }),
    });
    expect(noCsrfRes.status).toBeGreaterThanOrEqual(400);
  });

  it('manual creation: happy path with title creates a stopped entry, running entry untouched', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const running = await (await startEntry(jar, token, { title: 'Still Running' })).json();

    const startedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stoppedAt = new Date(Date.now() - 3_600_000).toISOString();
    const res = await startEntry(jar, token, { title: 'Manual Entry', startedAt, stoppedAt });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.taskName).toBe('Manual Entry');
    expect(created.startedAt).toBe(startedAt);
    expect(created.stoppedAt).toBe(stoppedAt);

    const runningNow = await (await getRunning(jar)).json();
    expect(runningNow.id).toBe(running.id);

    await patchEntry(jar, token, running.id, { stoppedAt: new Date().toISOString() });
  });

  it('manual creation: happy path without title creates an untitled stopped entry', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const startedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stoppedAt = new Date(Date.now() - 3_600_000).toISOString();
    const res = await startEntry(jar, token, { startedAt, stoppedAt });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.taskId).toBeNull();
    expect(created.stoppedAt).toBe(stoppedAt);
  });

  it('manual creation: invalid pair rejected with a messageKey', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');

    const onlyStart = await startEntry(jar, token, { startedAt: new Date().toISOString() });
    expect(onlyStart.status).toBe(422);

    const startedAt = new Date().toISOString();
    const stoppedAt = new Date(Date.now() - 3_600_000).toISOString();
    const inverted = await startEntry(jar, token, { startedAt, stoppedAt });
    expect(inverted.status).toBe(422);

    const futureStart = new Date(Date.now() + 3_600_000).toISOString();
    const futureStop = new Date(Date.now() + 7_200_000).toISOString();
    const future = await startEntry(jar, token, { startedAt: futureStart, stoppedAt: futureStop });
    expect(future.status).toBe(422);
  });

  it('startedAt patch: edits a stopped entry, rejects future start on running, rejects start after stop, allows overlap', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');

    // Stopped-entry edit
    const startedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stoppedAt = new Date(Date.now() - 3_600_000).toISOString();
    const stopped = await (
      await startEntry(jar, token, { title: 'Stopped Entry', startedAt, stoppedAt })
    ).json();
    const newStart = new Date(Date.now() - 2.5 * 3_600_000).toISOString();
    const editedStopped = await patchEntry(jar, token, stopped.id, { startedAt: newStart });
    expect(editedStopped.status).toBe(200);
    expect((await editedStopped.json()).startedAt).toBe(newStart);

    // Start after stop rejected
    const afterStop = new Date(Date.now() - 1800).toISOString();
    const startAfterStopRes = await patchEntry(jar, token, stopped.id, { startedAt: afterStop });
    expect(startAfterStopRes.status).toBe(422);
    expect((await startAfterStopRes.json())?.data?.messageKey).toBe(
      'error.timeEntryStoppedBeforeStarted',
    );

    // Running-entry edit rebasing elapsed
    const running = await (await startEntry(jar, token, { title: 'Running Entry' })).json();
    const pastStart = new Date(Date.now() - 3_600_000).toISOString();
    const editedRunning = await patchEntry(jar, token, running.id, { startedAt: pastStart });
    expect(editedRunning.status).toBe(200);
    const editedRunningBody = await editedRunning.json();
    expect(editedRunningBody.startedAt).toBe(pastStart);
    expect(editedRunningBody.stoppedAt).toBeNull();

    // Future start rejected on running entry
    const futureStart = new Date(Date.now() + 3_600_000).toISOString();
    const futureRes = await patchEntry(jar, token, running.id, { startedAt: futureStart });
    expect(futureRes.status).toBe(422);
    expect((await futureRes.json())?.data?.messageKey).toBe('error.timeEntryStartedAtInFuture');

    // Overlap accepted: move running entry's start to overlap the stopped entry
    const overlapRes = await patchEntry(jar, token, running.id, { startedAt });
    expect(overlapRes.status).toBe(200);

    // 404 for foreign/unknown id
    const bob = await loginAs('tbob@example.com', 'secret');
    const bobEntry = await (await startEntry(bob.jar, bob.token, { title: 'Bob Entry' })).json();
    const foreignRes = await patchEntry(jar, token, bobEntry.id, { startedAt: pastStart });
    expect(foreignRes.status).toBe(404);
    const unknownRes = await patchEntry(jar, token, '00000000-0000-0000-0000-000000000000', {
      startedAt: pastStart,
    });
    expect(unknownRes.status).toBe(404);

    await patchEntry(bob.jar, bob.token, bobEntry.id, { stoppedAt: new Date().toISOString() });
    await patchEntry(jar, token, running.id, { stoppedAt: new Date().toISOString() });
  });

  it('patch title only keeps the entry current project scope (no silent unassign)', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'TE Title Only Client ' + Date.now());
    const project = await createProject(
      jar,
      token,
      'TE Title Only Project ' + Date.now(),
      client.id,
    );

    const created = await (
      await startEntry(jar, token, { title: 'Scoped Entry ' + Date.now(), projectId: project.id })
    ).json();

    const retitled = await patchEntry(jar, token, created.id, { title: 'Retitled ' + Date.now() });
    expect(retitled.status).toBe(200);
    const retitledBody = await retitled.json();
    expect(retitledBody.projectId).toBe(project.id);

    await patchEntry(jar, token, created.id, { stoppedAt: new Date().toISOString() });
  });

  it('patch projectId: null moves the entry to the project-less scope', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const client = await createClient(jar, token, 'TE Clear Client ' + Date.now());
    const project = await createProject(jar, token, 'TE Clear Project ' + Date.now(), client.id);
    const title = 'Clear Scope Entry ' + Date.now();

    const created = await (await startEntry(jar, token, { title, projectId: project.id })).json();

    const cleared = await patchEntry(jar, token, created.id, { title, projectId: null });
    expect(cleared.status).toBe(200);
    const clearedBody = await cleared.json();
    expect(clearedBody.projectId).toBeNull();

    await patchEntry(jar, token, created.id, { stoppedAt: new Date().toISOString() });
  });

  it('delete: keeps the task when sibling entries remain', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const title = 'Delete Sibling Task ' + Date.now();
    const startedAt1 = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stoppedAt1 = new Date(Date.now() - 3_600_000).toISOString();
    const entry1 = await (
      await startEntry(jar, token, { title, startedAt: startedAt1, stoppedAt: stoppedAt1 })
    ).json();
    const startedAt2 = new Date(Date.now() - 1_800_000).toISOString();
    const stoppedAt2 = new Date(Date.now() - 900_000).toISOString();
    const entry2 = await (
      await startEntry(jar, token, { title, startedAt: startedAt2, stoppedAt: stoppedAt2 })
    ).json();
    expect(entry1.taskId).toBe(entry2.taskId);

    const delRes = await deleteEntry(jar, token, entry1.id);
    expect(delRes.status).toBe(200);

    const from = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const to = new Date().toISOString();
    const rows = await (await listEntries(jar, from, to)).json();
    const remaining = rows.find((r: { id: string }) => r.id === entry2.id);
    expect(remaining.taskId).toBe(entry2.taskId);
    expect(remaining.taskName).toBe(title);
  });

  it('delete: garbage collects the task when it was the last referencing entry', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const title = 'Delete Last Task ' + Date.now();
    const startedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stoppedAt = new Date(Date.now() - 3_600_000).toISOString();
    const entry = await (await startEntry(jar, token, { title, startedAt, stoppedAt })).json();

    const delRes = await deleteEntry(jar, token, entry.id);
    expect(delRes.status).toBe(200);

    // Re-creating an entry with the same title should mint a fresh task id
    const recreated = await (await startEntry(jar, token, { title, startedAt, stoppedAt })).json();
    expect(recreated.taskId).not.toBe(entry.taskId);
  });

  it('delete: an untitled entry is removed without affecting any task', async () => {
    const { jar, token } = await loginAs('talice@example.com', 'secret');
    const startedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stoppedAt = new Date(Date.now() - 3_600_000).toISOString();
    const entry = await (await startEntry(jar, token, { startedAt, stoppedAt })).json();
    expect(entry.taskId).toBeNull();

    const delRes = await deleteEntry(jar, token, entry.id);
    expect(delRes.status).toBe(200);
  });

  it('delete: 404 for foreign/unknown id, 401 unauthenticated', async () => {
    const alice = await loginAs('talice@example.com', 'secret');
    const bob = await loginAs('tbob@example.com', 'secret');
    const bobEntry = await (await startEntry(bob.jar, bob.token, { title: 'Bob Delete' })).json();
    await patchEntry(bob.jar, bob.token, bobEntry.id, { stoppedAt: new Date().toISOString() });

    const foreignRes = await deleteEntry(alice.jar, alice.token, bobEntry.id);
    expect(foreignRes.status).toBe(404);

    const unknownRes = await deleteEntry(
      alice.jar,
      alice.token,
      '00000000-0000-0000-0000-000000000000',
    );
    expect(unknownRes.status).toBe(404);

    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    const unauthRes = await deleteEntry(anonJar, anonToken, bobEntry.id);
    expect(unauthRes.status).toBe(401);

    await deleteEntry(bob.jar, bob.token, bobEntry.id);
  });
});
