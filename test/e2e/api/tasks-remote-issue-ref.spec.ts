import { expect, it, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { url } from '../helpers/url';
import type { CookieJar } from '../helpers/auth';
import { seedAndLogin } from '../helpers/session';
import { createProject, createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { UNKNOWN_ID } from '../helpers/fixtures';
import { createDatabaseClient } from '../../../server/db/client';
import { trackers, timeEntries, tasks, remoteExports } from '../../../server/db/schema';
import type { JsonObject } from '../../../shared/types/json';

const describeRemoteIssueRef = requireDocker();

async function createTaskViaEntry(
  jar: CookieJar,
  token: string,
  title: string,
  projectId?: string | null,
  startedAt?: string,
): Promise<{ id: string; name: string; projectId: string | null; entryId: string }> {
  const times = {
    title,
    startedAt: startedAt ?? new Date().toISOString(),
    stoppedAt: startedAt
      ? new Date(new Date(startedAt).getTime() + 3600_000).toISOString()
      : new Date(Date.now() + 3600_000).toISOString(),
  };
  const body = projectId === undefined ? times : { ...times, projectId };
  const startRes = await fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
  const entry = await startRes.json();

  const tasksRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
  const rows: { id: string; name: string; projectId: string | null }[] = await tasksRes.json();
  const found = rows.find((r) => r.id === entry.taskId);
  if (!found) throw new Error('task not found after creating via time entry');
  return { ...found, entryId: entry.id };
}

function reassign(jar: CookieJar, token: string, body: JsonObject): Promise<Response> {
  return fetch(url('/api/time-entries/reassign'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
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

const openProjectConfig = {
  systemType: 'openproject' as const,
  baseUrl: 'https://op.example.com',
  executionMode: 'client' as const,
  roundingRule: 'none' as const,
};

const redmineConfig = {
  systemType: 'redmine' as const,
  baseUrl: 'https://redmine.example.com',
  executionMode: 'client' as const,
  roundingRule: 'none' as const,
};

describeRemoteIssueRef('day-scoped remote issue linking via reassign', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });
  const { db, sql } = createDatabaseClient(dbUrl);

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  async function setupTaskWithOpenProjectConfig(label: string): Promise<{
    jar: CookieJar;
    token: string;
    taskId: string;
    entryId: string;
    trackerId: string;
    projectId: string;
  }> {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(
      jar,
      token,
      `${label} Tracker ${Date.now()}`,
      openProjectConfig,
    );
    const project = await createProject(jar, token, `${label} Project ${Date.now()}`, tracker.id);
    const task = await createTaskViaEntry(jar, token, `${label} Task ${Date.now()}`, project.id);
    return {
      jar,
      token,
      taskId: task.id,
      entryId: task.entryId,
      trackerId: tracker.id,
      projectId: project.id,
    };
  }

  it('links a day via reassign and replaces with a different issue', async () => {
    const { jar, token, entryId } = await setupTaskWithOpenProjectConfig('Link');

    const first = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '10',
      cachedTitle: 'First',
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody[0]?.remoteIssueRef?.remoteIssueId).toBe('10');
    expect(firstBody[0]?.remoteIssueRef?.url).toBe('https://op.example.com/work_packages/10');

    const second = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '20',
      cachedTitle: 'Second',
    });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody[0]?.remoteIssueRef?.remoteIssueId).toBe('20');
    expect(secondBody[0]?.taskId).not.toBe(firstBody[0]?.taskId);
  });

  it('persists a cached remote project title and allows linking without one', async () => {
    const { jar, token, entryId } = await setupTaskWithOpenProjectConfig('ProjectTitle');

    const withTitle = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '80',
      cachedTitle: 'With project',
      cachedRemoteProjectTitle: '  Acme Intranet  ',
    });
    expect(withTitle.status).toBe(200);
    const withTitleBody = await withTitle.json();
    expect(withTitleBody[0]?.remoteIssueRef?.cachedRemoteProjectTitle).toBe('Acme Intranet');
    const [withTitleTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, withTitleBody[0]?.taskId));
    expect(withTitleTask?.remoteIssueCachedProjectTitle).toBe('Acme Intranet');

    const withoutTitle = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '81',
      cachedTitle: 'No project',
    });
    expect(withoutTitle.status).toBe(200);
    const withoutTitleBody = await withoutTitle.json();
    expect(withoutTitleBody[0]?.remoteIssueRef?.cachedRemoteProjectTitle).toBeUndefined();
    const [withoutTitleTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, withoutTitleBody[0]?.taskId));
    expect(withoutTitleTask?.remoteIssueCachedProjectTitle).toBeNull();
  });

  it('explicit null unlinks day-scoped and is idempotent', async () => {
    const { jar, token, entryId } = await setupTaskWithOpenProjectConfig('Unlink');
    await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '30',
      cachedTitle: 'Some issue',
    });

    const first = await reassign(jar, token, { ids: [entryId], remoteIssueId: null });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody[0]?.remoteIssueRef).toBeUndefined();

    const second = await reassign(jar, token, { ids: [entryId], remoteIssueId: null });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody[0]?.taskId).toBe(firstBody[0]?.taskId);
  });

  it('day-scoped link leaves other days untouched', async () => {
    const { jar, token, projectId } = await setupTaskWithOpenProjectConfig('DayScope');
    const title = `Shared ${Date.now()}`;
    const day1 = await createTaskViaEntry(jar, token, title, projectId, '2026-03-01T10:00:00.000Z');
    const day2 = await createTaskViaEntry(jar, token, title, projectId, '2026-03-02T10:00:00.000Z');
    // Both days start on the same unlinked task.
    expect(day1.id).toBe(day2.id);

    const linkDay1 = await reassign(jar, token, {
      ids: [day1.entryId],
      remoteIssueId: '4711',
      cachedTitle: 'Issue 4711',
    });
    expect(linkDay1.status).toBe(200);
    const day1Body = await linkDay1.json();
    expect(day1Body[0]?.remoteIssueRef?.remoteIssueId).toBe('4711');

    const linkDay2 = await reassign(jar, token, {
      ids: [day2.entryId],
      remoteIssueId: '4899',
      cachedTitle: 'Issue 4899',
    });
    expect(linkDay2.status).toBe(200);
    const day2Body = await linkDay2.json();
    expect(day2Body[0]?.remoteIssueRef?.remoteIssueId).toBe('4899');
    expect(day2Body[0]?.taskId).not.toBe(day1Body[0]?.taskId);

    const [entry1] = await db.select().from(timeEntries).where(eq(timeEntries.id, day1.entryId));
    const [entry2] = await db.select().from(timeEntries).where(eq(timeEntries.id, day2.entryId));
    expect(entry1?.taskId).toBe(day1Body[0]?.taskId);
    expect(entry2?.taskId).toBe(day2Body[0]?.taskId);

    const taskRows = await db.select().from(tasks).where(eq(tasks.name, title));
    expect(taskRows).toHaveLength(2);
  });

  it('omitted remoteIssueId keeps the current issue when renaming', async () => {
    const { jar, token, entryId } = await setupTaskWithOpenProjectConfig('KeepIssue');
    const linked = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '55',
      cachedTitle: 'Keep me',
    });
    const linkedBody = await linked.json();
    // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
    const linkedTaskId = linkedBody[0]?.taskId as string;

    const renamed = await reassign(jar, token, {
      ids: [entryId],
      name: `Renamed ${Date.now()}`,
    });
    expect(renamed.status).toBe(200);
    const renamedBody = await renamed.json();
    expect(renamedBody[0]?.remoteIssueRef?.remoteIssueId).toBe('55');
    // Source may be GC'd; target carries the same issue.
    const [task] = await db.select().from(tasks).where(eq(tasks.id, renamedBody[0]?.taskId));
    expect(task?.remoteIssueId).toBe('55');
    if (renamedBody[0]?.taskId !== linkedTaskId) {
      const old = await db.select().from(tasks).where(eq(tasks.id, linkedTaskId));
      expect(old).toHaveLength(0);
    }
  });

  it('rejects linking a project-less target', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const task = await createTaskViaEntry(jar, token, `Projectless ${Date.now()}`);

    const res = await reassign(jar, token, {
      ids: [task.entryId],
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteIssueTaskNoConfig');
  });

  it('rejects linking when the project has no active tracker', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    // Local project (trackerId null) cannot resolve an active tracker for linking.
    const project = await createProject(jar, token, `NoTracker Project ${Date.now()}`);
    const task = await createTaskViaEntry(jar, token, `NoTracker Task ${Date.now()}`, project.id);

    const res = await reassign(jar, token, {
      ids: [task.entryId],
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.remoteIssueTaskNoConfig');
  });

  it('links against a Redmine configuration and derives an issues URL', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, `Redmine Tracker ${Date.now()}`, redmineConfig);
    const project = await createProject(jar, token, `Redmine Project ${Date.now()}`, tracker.id);
    const task = await createTaskViaEntry(jar, token, `Redmine Task ${Date.now()}`, project.id);

    const res = await reassign(jar, token, {
      ids: [task.entryId],
      remoteIssueId: '77',
      cachedTitle: 'Redmine issue',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]?.remoteIssueRef?.remoteIssueId).toBe('77');
    expect(body[0]?.remoteIssueRef?.url).toBe('https://redmine.example.com/issues/77');
  });

  it('foreign/unknown entry ids → 404', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const bobTask = await createTaskViaEntry(bob.jar, bob.token, `Bob Task ${Date.now()}`);

    const missing = await reassign(alice.jar, alice.token, {
      ids: [UNKNOWN_ID],
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(missing.status).toBe(404);

    const foreign = await reassign(alice.jar, alice.token, {
      ids: [bobTask.entryId],
      remoteIssueId: '1',
      cachedTitle: 'x',
    });
    expect(foreign.status).toBe(404);
  });

  it('task-global remote-issue-ref routes are absent', async () => {
    const { jar, token, taskId } = await setupTaskWithOpenProjectConfig('Gone');
    const post = await fetch(url(`/api/tasks/${taskId}/remote-issue-ref`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ remoteIssueId: '1', cachedTitle: 'x' }),
    });
    expect([404, 405]).toContain(post.status);

    const del = await fetch(url(`/api/tasks/${taskId}/remote-issue-ref`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    expect([404, 405]).toContain(del.status);
  });

  it('PATCH merges when name/project/issue all collide and never changes remote issue', async () => {
    const { jar, token, projectId } = await setupTaskWithOpenProjectConfig('Merge');
    const suffix = Date.now();
    const survivor = await createTaskViaEntry(jar, token, `Surv ${suffix}`, projectId);
    const loser = await createTaskViaEntry(jar, token, `Lose ${suffix}`, projectId);

    await reassign(jar, token, {
      ids: [survivor.entryId],
      remoteIssueId: '100',
      cachedTitle: 'Same',
    });
    await reassign(jar, token, {
      ids: [loser.entryId],
      remoteIssueId: '100',
      cachedTitle: 'Same',
    });

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const list: { id: string; remoteIssueRef?: { remoteIssueId: string } }[] = await listRes.json();
    const linkedLoser = list.find(
      (r) => r.remoteIssueRef?.remoteIssueId === '100' && r.id !== survivor.id,
    );
    // After linking, loser entry may sit on a new task id.
    const loserTaskId =
      linkedLoser?.id ??
      (await db.select().from(timeEntries).where(eq(timeEntries.id, loser.entryId)))[0]!.taskId!;

    const survivorTaskId = (
      await db.select().from(timeEntries).where(eq(timeEntries.id, survivor.entryId))
    )[0]!.taskId!;
    const [survRow] = await db.select().from(tasks).where(eq(tasks.id, survivorTaskId));

    const res = await patchTask(jar, token, loserTaskId, {
      name: survRow!.name,
      projectId,
    });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expect(merged.id).toBe(survivorTaskId);
    expect(merged.remoteIssueRef?.remoteIssueId).toBe('100');
  });

  it('PATCH rename onto a different remote issue does not merge and does not 409', async () => {
    const { jar, token, projectId } = await setupTaskWithOpenProjectConfig('NoMerge');
    const suffix = Date.now();
    const a = await createTaskViaEntry(jar, token, `A ${suffix}`, projectId);
    const b = await createTaskViaEntry(jar, token, `B ${suffix}`, projectId);

    await reassign(jar, token, {
      ids: [a.entryId],
      remoteIssueId: '200',
      cachedTitle: 'A issue',
    });
    await reassign(jar, token, {
      ids: [b.entryId],
      remoteIssueId: '201',
      cachedTitle: 'B issue',
    });

    const aTaskId = (await db.select().from(timeEntries).where(eq(timeEntries.id, a.entryId)))[0]!
      .taskId!;
    const bTaskId = (await db.select().from(timeEntries).where(eq(timeEntries.id, b.entryId)))[0]!
      .taskId!;
    const [bRow] = await db.select().from(tasks).where(eq(tasks.id, bTaskId));

    const res = await patchTask(jar, token, aTaskId, {
      name: bRow!.name,
      projectId,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(aTaskId);
    expect(body.remoteIssueRef?.remoteIssueId).toBe('200');

    const stillB = await db.select().from(tasks).where(eq(tasks.id, bTaskId));
    expect(stillB).toHaveLength(1);
  });

  it('export provenance survives garbage collection of its task', async () => {
    const { jar, token, entryId, projectId } = await setupTaskWithOpenProjectConfig('GC');
    const linked = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '300',
      cachedTitle: 'Exported',
    });
    const linkedBody = await linked.json();
    // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
    const taskId = linkedBody[0]?.taskId as string;

    const [userRow] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    const [exportRow] = await db
      .insert(remoteExports)
      .values({
        userId: userRow!.userId,
        taskId,
        localDate: '2026-03-15',
        remoteIssueId: '300',
        remoteLogId: 'log-gc',
        exportDurationSeconds: 3600,
        requiredFieldValues: {},
      })
      .returning();

    // Move the only entry away so the source task is garbage-collected.
    const moved = await reassign(jar, token, {
      ids: [entryId],
      name: `Moved ${Date.now()}`,
      projectId,
    });
    expect(moved.status).toBe(200);

    const sourceGone = await db.select().from(tasks).where(eq(tasks.id, taskId));
    expect(sourceGone).toHaveLength(0);

    const [surviving] = await db
      .select()
      .from(remoteExports)
      .where(eq(remoteExports.id, exportRow!.id));
    expect(surviving).toBeDefined();
    expect(surviving!.taskId).toBeNull();
    expect(surviving!.remoteIssueId).toBe('300');
  });

  it('enriches the task list DTO with a URL for a linked task', async () => {
    const { jar, token, entryId } = await setupTaskWithOpenProjectConfig('Enrich');
    const linked = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '50',
      cachedTitle: 'Enriched',
    });
    const linkedBody = await linked.json();
    // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
    const taskId = linkedBody[0]?.taskId as string;

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string; remoteIssueId: string } }[] =
      await listRes.json();
    const found = rows.find((r) => r.id === taskId);
    expect(found?.remoteIssueRef?.remoteIssueId).toBe('50');
    expect(found?.remoteIssueRef?.url).toBe('https://op.example.com/work_packages/50');
  });

  it('omits the url once the linked config is soft-deleted, keeping cached id/title', async () => {
    const { jar, token, entryId, trackerId } = await setupTaskWithOpenProjectConfig('SoftDelete');
    const linked = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '60',
      cachedTitle: 'Bare after delete',
    });
    // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
    const taskId = (await linked.json())[0]?.taskId as string;

    await fetch(url(`/api/trackers/${trackerId}`), {
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

  it('identity-changing tracker updates leave existing references resolvable under the new baseUrl', async () => {
    const { jar, token, entryId, trackerId } =
      await setupTaskWithOpenProjectConfig('IdentityChange');
    const linked = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '300',
      cachedTitle: 'Rebase',
    });
    // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
    const taskId = (await linked.json())[0]?.taskId as string;

    const patchRes = await fetch(url(`/api/trackers/${trackerId}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': token,
        cookie: jar.header(),
      },
      body: JSON.stringify({
        name: 'Rebased Tracker',
        ...openProjectConfig,
        baseUrl: 'https://op2.example.com',
      }),
    });
    expect(patchRes.status).toBe(200);

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string } }[] = await listRes.json();
    const found = rows.find((r) => r.id === taskId);
    expect(found?.remoteIssueRef?.url).toBe('https://op2.example.com/work_packages/300');
  });

  it('does not rebind to a newly created replacement tracker after the old one was deleted', async () => {
    const { jar, token, entryId, trackerId } = await setupTaskWithOpenProjectConfig('NoRebind');
    const linked = await reassign(jar, token, {
      ids: [entryId],
      remoteIssueId: '400',
      cachedTitle: 'Stale ref',
    });
    // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
    const taskId = (await linked.json())[0]?.taskId as string;
    const [taskBefore] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    const oldConfigId = taskBefore!.trackerId!;

    await fetch(url(`/api/trackers/${trackerId}`), {
      method: 'DELETE',
      headers: { 'csrf-token': token, cookie: jar.header() },
    });
    await createTracker(jar, token, `Replacement ${Date.now()}`, openProjectConfig);

    const listRes = await fetch(url('/api/tasks'), { headers: { cookie: jar.header() } });
    const rows: { id: string; remoteIssueRef?: { url?: string; cachedTitle: string } }[] =
      await listRes.json();
    const found = rows.find((r) => r.id === taskId);
    expect(found?.remoteIssueRef?.cachedTitle).toBe('Stale ref');
    expect(found?.remoteIssueRef?.url).toBeUndefined();

    const [oldConfig] = await db.select().from(trackers).where(eq(trackers.id, oldConfigId));
    expect(oldConfig?.deletedAt).not.toBeNull();
  });
});
