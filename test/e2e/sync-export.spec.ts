import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { createDatabaseClient } from '../../server/db/client';
import { remoteExportEntries, remoteExports } from '../../server/db/schema';
import { eq } from 'drizzle-orm';

const describeSyncExport = requireDocker();

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
): Promise<{ id: string; taskId: string | null }> {
  const res = await fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return res.json();
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
  expect(res.status).toBe(200);
  return res.json();
}

async function linkIssue(
  jar: CookieJar,
  token: string,
  taskId: string,
  remoteIssueId: string,
  cachedTitle: string,
) {
  const res = await fetch(url(`/api/tasks/${taskId}/remote-issue-ref`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ remoteIssueId, cachedTitle }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function finalize(
  jar: CookieJar,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(url('/api/sync/export'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

describeSyncExport('sync export finalization API', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'exportalice@example.com', displayName: 'Alice' },
    { email: 'exportbob@example.com', displayName: 'Bob' },
  ]);
  await setupServer({ databaseUrl: dbUrl });

  async function seedLinkedTask(jar: CookieJar, token: string, suffix: string) {
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });
    const client = await createClient(jar, token, `Export Client ${suffix}`);
    const project = await createProject(jar, token, `Export Project ${suffix}`, client.id);
    await putRemoteConfig(jar, token, client.id, {
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      executionMode: 'client',
      transportMode: 'direct',
      roundingRule: 'none',
    });
    const date = '2026-04-01';
    const entry = await createEntry(jar, token, {
      title: `Export Task ${suffix}`,
      projectId: project.id,
      startedAt: `${date}T10:00:00.000Z`,
      stoppedAt: `${date}T10:30:00.000Z`,
    });
    expect(entry.taskId).toBeTruthy();
    await linkIssue(jar, token, entry.taskId!, '42', 'Linked issue');
    return { date, entry, client, project };
  }

  it('finalizes a successful export and records provenance', async () => {
    const { jar, token } = await loginAs('exportalice@example.com', 'secret');
    const { date, entry } = await seedLinkedTask(jar, token, String(Date.now()));

    const res = await finalize(jar, token, {
      taskId: entry.taskId,
      localDate: date,
      remoteIssueId: '42',
      remoteLogId: `log-${Date.now()}`,
      exportDurationSeconds: 1800,
      requiredFieldValues: { activity: '1' },
      entryIds: [entry.id],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replayed).toBe(false);
    expect(body.entryIds).toEqual([entry.id]);
    expect(body.exportDurationSeconds).toBe(1800);
    expect(body.requiredFieldValues).toEqual({ activity: '1' });

    const day = await (
      await fetch(url(`/api/sync/day?date=${date}`), { headers: { cookie: jar.header() } })
    ).json();
    const row = day.rows.find((r: { taskId: string }) => r.taskId === entry.taskId);
    expect(row.entries).toHaveLength(1);
    expect(row.entries[0].previouslyExported).toBe(true);
    expect(row.exports).toHaveLength(1);
    expect(row.exports[0].remoteLogId).toBe(body.remoteLogId);
  });

  it('replays a known finalized remote log without creating another row', async () => {
    const { jar, token } = await loginAs('exportalice@example.com', 'secret');
    const { date, entry } = await seedLinkedTask(jar, token, `replay-${Date.now()}`);
    const remoteLogId = `replay-log-${Date.now()}`;

    const first = await finalize(jar, token, {
      taskId: entry.taskId,
      localDate: date,
      remoteIssueId: '42',
      remoteLogId,
      exportDurationSeconds: 1800,
      requiredFieldValues: { activity: '1' },
      entryIds: [entry.id],
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await finalize(jar, token, {
      taskId: entry.taskId,
      localDate: date,
      remoteIssueId: '42',
      remoteLogId,
      exportDurationSeconds: 9999,
      requiredFieldValues: { activity: '9' },
      entryIds: [entry.id],
    });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.exportId).toBe(firstBody.exportId);
    expect(secondBody.exportDurationSeconds).toBe(1800);

    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const rows = await db
        .select()
        .from(remoteExports)
        .where(eq(remoteExports.remoteLogId, remoteLogId));
      expect(rows).toHaveLength(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('allows an intentional repeat export with a new remote log id', async () => {
    const { jar, token } = await loginAs('exportalice@example.com', 'secret');
    const { date, entry } = await seedLinkedTask(jar, token, `repeat-${Date.now()}`);

    const first = await finalize(jar, token, {
      taskId: entry.taskId,
      localDate: date,
      remoteIssueId: '42',
      remoteLogId: `first-${Date.now()}`,
      exportDurationSeconds: 1800,
      entryIds: [entry.id],
    });
    expect(first.status).toBe(200);

    const second = await finalize(jar, token, {
      taskId: entry.taskId,
      localDate: date,
      remoteIssueId: '42',
      remoteLogId: `second-${Date.now()}`,
      exportDurationSeconds: 1800,
      entryIds: [entry.id],
    });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.replayed).toBe(false);

    const day = await (
      await fetch(url(`/api/sync/day?date=${date}`), { headers: { cookie: jar.header() } })
    ).json();
    const row = day.rows.find((r: { taskId: string }) => r.taskId === entry.taskId);
    expect(row.exports).toHaveLength(2);
  });

  it('rejects stale, mismatched, foreign, and incomplete payloads', async () => {
    const alice = await loginAs('exportalice@example.com', 'secret');
    const bob = await loginAs('exportbob@example.com', 'secret');
    const seeded = await seedLinkedTask(alice.jar, alice.token, `reject-${Date.now()}`);

    const bobSeed = await seedLinkedTask(bob.jar, bob.token, `bob-${Date.now()}`);

    const foreign = await finalize(alice.jar, alice.token, {
      taskId: seeded.entry.taskId,
      localDate: seeded.date,
      remoteIssueId: '42',
      remoteLogId: `foreign-${Date.now()}`,
      exportDurationSeconds: 1800,
      entryIds: [bobSeed.entry.id],
    });
    expect(foreign.status).toBe(422);

    const wrongIssue = await finalize(alice.jar, alice.token, {
      taskId: seeded.entry.taskId,
      localDate: seeded.date,
      remoteIssueId: '999',
      remoteLogId: `wrong-issue-${Date.now()}`,
      exportDurationSeconds: 1800,
      entryIds: [seeded.entry.id],
    });
    expect(wrongIssue.status).toBe(422);

    const wrongDay = await finalize(alice.jar, alice.token, {
      taskId: seeded.entry.taskId,
      localDate: '2026-04-02',
      remoteIssueId: '42',
      remoteLogId: `wrong-day-${Date.now()}`,
      exportDurationSeconds: 1800,
      entryIds: [seeded.entry.id],
    });
    expect(wrongDay.status).toBe(422);

    const invalid = await finalize(alice.jar, alice.token, {
      taskId: seeded.entry.taskId,
      localDate: seeded.date,
      remoteIssueId: '42',
      remoteLogId: `invalid-${Date.now()}`,
      exportDurationSeconds: 0,
      entryIds: [seeded.entry.id],
    });
    expect(invalid.status).toBe(422);

    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const orphanLinks = await db
        .select()
        .from(remoteExportEntries)
        .where(eq(remoteExportEntries.entryId, seeded.entry.id));
      // No partial provenance from rejected attempts.
      expect(orphanLinks.every((l) => l.exportId)).toBe(true);
      const exportsForTask = await db
        .select()
        .from(remoteExports)
        .where(eq(remoteExports.taskId, seeded.entry.taskId!));
      expect(exportsForTask).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('requires authentication', async () => {
    const jar = new CookieJar();
    const res = await finalize(jar, 'nope', {
      taskId: '01900000-0000-7000-8000-000000000001',
      localDate: '2026-04-01',
      remoteIssueId: '42',
      remoteLogId: '1',
      exportDurationSeconds: 60,
      entryIds: ['01900000-0000-7000-8000-0000000000aa'],
    });
    expect(res.status).toBe(401);
  });
});
