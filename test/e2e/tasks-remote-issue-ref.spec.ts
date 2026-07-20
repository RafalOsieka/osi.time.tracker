import { expect, it, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { createDatabaseClient } from '../../server/db/client';
import { remoteIssueRefs, remoteSystemConfigs, timeEntries, tasks } from '../../server/db/schema';

const describeRemoteIssueRef = requireDocker();

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

async function createProject(
  jar: CookieJar,
  token: string,
  name: string,
  clientId: string,
): Promise<{ id: string }> {
  const res = await fetch(url('/api/projects'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ name, clientId }),
  });
  return res.json();
}

async function putRemoteConfig(
  jar: CookieJar,
  token: string,
  clientId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url(`/api/clients/${clientId}/remote-config`), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

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

function linkRef(
  jar: CookieJar,
  token: string,
  taskId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url(`/api/tasks/${taskId}/remote-issue-ref`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

function unlinkRef(jar: CookieJar, token: string, taskId: string): Promise<Response> {
  return fetch(url(`/api/tasks/${taskId}/remote-issue-ref`), {
    method: 'DELETE',
    headers: { 'csrf-token': token, cookie: jar.header() },
  });
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

const openProjectConfig = {
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
};

const redmineConfig = {
  systemType: 'redmine',
  baseUrl: 'https://redmine.example.com',
  executionMode: 'client',
  roundingRule: 'none',
};

describeRemoteIssueRef('remote issue ref link/unlink API and DTO enrichment', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'ralice@example.com', displayName: 'Alice' },
    { email: 'rbob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });
  const { db, sql } = createDatabaseClient(dbUrl);

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  async function setupTaskWithOpenProjectConfig(
    label: string,
  ): Promise<{ jar: CookieJar; token: string; taskId: string; clientId: string }> {
    const { jar, token } = await loginAs('ralice@example.com', 'secret');
    const client = await createClient(jar, token, `${label} Client ${Date.now()}`);
    const project = await createProject(jar, token, `${label} Project ${Date.now()}`, client.id);
    await putRemoteConfig(jar, token, client.id, openProjectConfig);
    const task = await createTaskViaEntry(jar, token, `${label} Task ${Date.now()}`, project.id);
    return { jar, token, taskId: task.id, clientId: client.id };
  }

  it('links a task then replaces the reference on a second link', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Link');

    const first = await linkRef(jar, token, taskId, { remoteIssueId: '10', cachedTitle: 'First' });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.remoteIssueId).toBe('10');
    expect(firstBody.url).toBe('https://op.example.com/work_packages/10');

    const second = await linkRef(jar, token, taskId, {
      remoteIssueId: '20',
      cachedTitle: 'Second',
    });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.remoteIssueId).toBe('20');

    const rows = await db.select().from(remoteIssueRefs).where(eq(remoteIssueRefs.taskId, taskId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.remoteIssueId).toBe('20');
  });

  it('unlink is idempotent', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Unlink');
    await linkRef(jar, token, taskId, { remoteIssueId: '30', cachedTitle: 'Some issue' });

    const first = await unlinkRef(jar, token, taskId);
    expect(first.status).toBe(200);

    const second = await unlinkRef(jar, token, taskId);
    expect(second.status).toBe(200);

    const rows = await db.select().from(remoteIssueRefs).where(eq(remoteIssueRefs.taskId, taskId));
    expect(rows).toHaveLength(0);
  });

  it('rejects invalid input with 422', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Invalid');

    const res = await linkRef(jar, token, taskId, { remoteIssueId: '', cachedTitle: '' });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteIssueIdRequired');
  });

  it('strips unknown/extra fields from the request body instead of erroring', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Strip');

    const res = await linkRef(jar, token, taskId, {
      remoteIssueId: '40',
      cachedTitle: 'Stripped',
      apiKey: 'super-secret-should-not-persist',
    });
    expect(res.status).toBe(200);

    const [row] = await db.select().from(remoteIssueRefs).where(eq(remoteIssueRefs.taskId, taskId));
    expect(row).toBeDefined();
    // The schema doesn't even define an apiKey/credential column, so nothing extra can persist.
    expect(Object.keys(row!)).not.toContain('apiKey');
  });

  it('rejects linking a project-less task', async () => {
    const { jar, token } = await loginAs('ralice@example.com', 'secret');
    const task = await createTaskViaEntry(jar, token, `Projectless ${Date.now()}`);

    const res = await linkRef(jar, token, task.id, { remoteIssueId: '1', cachedTitle: 'x' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteIssueTaskNoConfig');
  });

  it('rejects linking when the client has no active remote config', async () => {
    const { jar, token } = await loginAs('ralice@example.com', 'secret');
    const client = await createClient(jar, token, `NoConfig Client ${Date.now()}`);
    const project = await createProject(jar, token, `NoConfig Project ${Date.now()}`, client.id);
    const task = await createTaskViaEntry(jar, token, `NoConfig Task ${Date.now()}`, project.id);

    const res = await linkRef(jar, token, task.id, { remoteIssueId: '1', cachedTitle: 'x' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteIssueTaskNoConfig');
  });

  it('links against a Redmine configuration and derives an issues URL', async () => {
    const { jar, token } = await loginAs('ralice@example.com', 'secret');
    const client = await createClient(jar, token, `Redmine Client ${Date.now()}`);
    const project = await createProject(jar, token, `Redmine Project ${Date.now()}`, client.id);
    await putRemoteConfig(jar, token, client.id, redmineConfig);
    const task = await createTaskViaEntry(jar, token, `Redmine Task ${Date.now()}`, project.id);

    const res = await linkRef(jar, token, task.id, {
      remoteIssueId: '77',
      cachedTitle: 'Redmine issue',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remoteIssueId).toBe('77');
    expect(body.cachedTitle).toBe('Redmine issue');
    expect(body.url).toBe('https://redmine.example.com/issues/77');

    const rows = await db.select().from(remoteIssueRefs).where(eq(remoteIssueRefs.taskId, task.id));
    expect(rows).toHaveLength(1);
  });

  it('foreign/unknown task ids → 404 for both link and unlink', async () => {
    const alice = await loginAs('ralice@example.com', 'secret');
    const bob = await loginAs('rbob@example.com', 'secret');
    const bobTask = await createTaskViaEntry(bob.jar, bob.token, `Bob Task ${Date.now()}`);

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const missing = await linkRef(alice.jar, alice.token, fakeId, {
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(missing.status).toBe(404);

    const foreign = await linkRef(alice.jar, alice.token, bobTask.id, {
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(foreign.status).toBe(404);

    const foreignUnlink = await unlinkRef(alice.jar, alice.token, bobTask.id);
    expect(foreignUnlink.status).toBe(404);
  });

  it('unauthenticated requests are rejected with 401', async () => {
    const { taskId } = await setupTaskWithOpenProjectConfig('Auth');
    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);

    const linkRes = await linkRef(anonJar, anonToken, taskId, {
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(linkRes.status).toBe(401);

    const unlinkRes = await unlinkRef(anonJar, anonToken, taskId);
    expect(unlinkRes.status).toBe(401);
  });

  it('enriches the task list DTO with a URL for a linked task, and omits it once unlinked', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Enrich');
    await linkRef(jar, token, taskId, { remoteIssueId: '50', cachedTitle: 'Enriched' });

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string; remoteIssueId: string } }[] =
      await listRes.json();
    const linked = rows.find((r) => r.id === taskId);
    expect(linked?.remoteIssueRef?.remoteIssueId).toBe('50');
    expect(linked?.remoteIssueRef?.url).toBe('https://op.example.com/work_packages/50');

    await unlinkRef(jar, token, taskId);
    const listAfter = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rowsAfter: { id: string; remoteIssueRef?: unknown }[] = await listAfter.json();
    const unlinked = rowsAfter.find((r) => r.id === taskId);
    expect(unlinked?.remoteIssueRef).toBeUndefined();
  });

  it('omits the url once the linked config is soft-deleted, keeping cached id/title', async () => {
    const { jar, token, taskId, clientId } = await setupTaskWithOpenProjectConfig('SoftDelete');
    await linkRef(jar, token, taskId, { remoteIssueId: '60', cachedTitle: 'Bare after delete' });

    await fetch(url(`/api/clients/${clientId}/remote-config`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string; cachedTitle: string } }[] =
      await listRes.json();
    const found = rows.find((r) => r.id === taskId);
    expect(found?.remoteIssueRef?.cachedTitle).toBe('Bare after delete');
    expect(found?.remoteIssueRef?.url).toBeUndefined();
  });

  it('strictly isolates references across users in list responses', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Isolation');
    await linkRef(jar, token, taskId, { remoteIssueId: '70', cachedTitle: 'Alices issue' });

    const bob = await loginAs('rbob@example.com', 'secret');
    const bobList = await fetch(url('/api/tasks'), { headers: { cookie: bob.jar.header() } });
    const bobRows: { id: string }[] = await bobList.json();
    expect(bobRows.find((r) => r.id === taskId)).toBeUndefined();
  });

  it('unlinked-task merges are unaffected', async () => {
    const { jar, token } = await loginAs('ralice@example.com', 'secret');
    const suffix = Date.now();
    const survivor = await createTaskViaEntry(jar, token, `PlainSurvivor ${suffix}`);
    const loser = await createTaskViaEntry(jar, token, `PlainLoser ${suffix}`);

    const res = await patchTask(jar, token, loser.id, { name: survivor.name });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expect(merged.id).toBe(survivor.id);
    expect(merged.remoteIssueRef).toBeUndefined();
  });

  it('preserves a source-only reference on the survivor after merge', async () => {
    const { jar, token, taskId: projectId } = await setupTaskWithOpenProjectConfig('SourceOnly');
    const suffix = Date.now();
    const listBefore = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rowsBefore = await listBefore.json();
    const seedTask = rowsBefore.find((r: { id: string }) => r.id === projectId);
    const projId: string = seedTask.projectId;

    const survivor = await createTaskViaEntry(jar, token, `SrcSurvivor ${suffix}`, projId);
    const loser = await createTaskViaEntry(jar, token, `SrcLoser ${suffix}`, projId);
    await linkRef(jar, token, loser.id, { remoteIssueId: '80', cachedTitle: 'Source ref' });

    const res = await patchTask(jar, token, loser.id, { name: survivor.name, projectId: projId });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expect(merged.id).toBe(survivor.id);
    expect(merged.remoteIssueRef?.remoteIssueId).toBe('80');

    const rows = await db
      .select()
      .from(remoteIssueRefs)
      .where(eq(remoteIssueRefs.taskId, survivor.id));
    expect(rows).toHaveLength(1);
  });

  it('preserves a survivor-only reference after merge', async () => {
    const { jar, token, taskId: seedTaskId } = await setupTaskWithOpenProjectConfig('SurvOnly');
    const suffix = Date.now();
    const listBefore = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rowsBefore = await listBefore.json();
    const seedTask = rowsBefore.find((r: { id: string }) => r.id === seedTaskId);
    const projId: string = seedTask.projectId;

    const survivor = await createTaskViaEntry(jar, token, `SurvSurvivor ${suffix}`, projId);
    const loser = await createTaskViaEntry(jar, token, `SurvLoser ${suffix}`, projId);
    await linkRef(jar, token, survivor.id, { remoteIssueId: '90', cachedTitle: 'Surv ref' });

    const res = await patchTask(jar, token, loser.id, { name: survivor.name, projectId: projId });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expect(merged.remoteIssueRef?.remoteIssueId).toBe('90');
  });

  it('collapses identical references from both tasks into one after merge', async () => {
    const { jar, token, taskId: seedTaskId } = await setupTaskWithOpenProjectConfig('Identical');
    const suffix = Date.now();
    const listBefore = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rowsBefore = await listBefore.json();
    const seedTask = rowsBefore.find((r: { id: string }) => r.id === seedTaskId);
    const projId: string = seedTask.projectId;

    const survivor = await createTaskViaEntry(jar, token, `IdenticalSurvivor ${suffix}`, projId);
    const loser = await createTaskViaEntry(jar, token, `IdenticalLoser ${suffix}`, projId);
    await linkRef(jar, token, survivor.id, { remoteIssueId: '100', cachedTitle: 'Same issue' });
    await linkRef(jar, token, loser.id, { remoteIssueId: '100', cachedTitle: 'Same issue' });

    const res = await patchTask(jar, token, loser.id, { name: survivor.name, projectId: projId });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expect(merged.remoteIssueRef?.remoteIssueId).toBe('100');

    const rows = await db
      .select()
      .from(remoteIssueRefs)
      .where(eq(remoteIssueRefs.taskId, survivor.id));
    expect(rows).toHaveLength(1);
  });

  it('rejects merging tasks with conflicting references with 409 and full rollback', async () => {
    const { jar, token, taskId: seedTaskId } = await setupTaskWithOpenProjectConfig('Conflict');
    const suffix = Date.now();
    const listBefore = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rowsBefore = await listBefore.json();
    const seedTask = rowsBefore.find((r: { id: string }) => r.id === seedTaskId);
    const projId: string = seedTask.projectId;

    const survivor = await createTaskViaEntry(jar, token, `ConflictSurvivor ${suffix}`, projId);
    const loser = await createTaskViaEntry(jar, token, `ConflictLoser ${suffix}`, projId);
    await linkRef(jar, token, survivor.id, { remoteIssueId: '200', cachedTitle: 'Survivor issue' });
    await linkRef(jar, token, loser.id, { remoteIssueId: '201', cachedTitle: 'Loser issue' });

    const res = await patchTask(jar, token, loser.id, { name: survivor.name, projectId: projId });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.taskMergeConflictingRemoteIssueRef');

    // Nothing changed: both tasks, their entries, and their refs are untouched.
    const survivorTask = await db.select().from(tasks).where(eq(tasks.id, survivor.id));
    const loserTask = await db.select().from(tasks).where(eq(tasks.id, loser.id));
    expect(survivorTask).toHaveLength(1);
    expect(loserTask).toHaveLength(1);

    const survivorRef = await db
      .select()
      .from(remoteIssueRefs)
      .where(eq(remoteIssueRefs.taskId, survivor.id));
    const loserRef = await db
      .select()
      .from(remoteIssueRefs)
      .where(eq(remoteIssueRefs.taskId, loser.id));
    expect(survivorRef[0]?.remoteIssueId).toBe('200');
    expect(loserRef[0]?.remoteIssueId).toBe('201');

    const loserEntries = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.taskId, loser.id));
    expect(loserEntries.length).toBeGreaterThan(0);
  });

  it('identity-changing config updates leave existing references resolvable under the new baseUrl', async () => {
    const { jar, token, taskId, clientId } = await setupTaskWithOpenProjectConfig('IdentityChange');
    await linkRef(jar, token, taskId, { remoteIssueId: '300', cachedTitle: 'Rebase' });

    await putRemoteConfig(jar, token, clientId, {
      ...openProjectConfig,
      baseUrl: 'https://op2.example.com',
    });

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string } }[] = await listRes.json();
    const found = rows.find((r) => r.id === taskId);
    expect(found?.remoteIssueRef?.url).toBe('https://op2.example.com/work_packages/300');
  });

  it('does not rebind to a newly created replacement config after the old one was deleted', async () => {
    const { jar, token, taskId, clientId } = await setupTaskWithOpenProjectConfig('NoRebind');
    await linkRef(jar, token, taskId, { remoteIssueId: '400', cachedTitle: 'Stale ref' });

    await fetch(url(`/api/clients/${clientId}/remote-config`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });

    // Creating a brand-new active config for the same client...
    await putRemoteConfig(jar, token, clientId, openProjectConfig);

    // ...must NOT cause the old reference (still pointing at the deleted config id) to regain a URL.
    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string; cachedTitle: string } }[] =
      await listRes.json();
    const found = rows.find((r) => r.id === taskId);
    expect(found?.remoteIssueRef?.cachedTitle).toBe('Stale ref');
    expect(found?.remoteIssueRef?.url).toBeUndefined();

    const [ref] = await db.select().from(remoteIssueRefs).where(eq(remoteIssueRefs.taskId, taskId));
    const [oldConfig] = await db
      .select()
      .from(remoteSystemConfigs)
      .where(eq(remoteSystemConfigs.id, ref!.remoteSystemConfigId));
    expect(oldConfig?.deletedAt).not.toBeNull();
  });
});
