import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { CookieJar, primeCsrf } from '../helpers/auth';
import { seedAndLogin } from '../helpers/session';
import { createProject, createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { createDatabaseClient } from '../../../server/db/client';
import { remoteExportEntries, remoteExports } from '../../../server/db/schema';
import { eq } from 'drizzle-orm';
import type { JsonObject } from '../../../shared/types/json';

const describeSyncExport = requireDocker();

async function createEntry(
  jar: CookieJar,
  token: string,
  body: JsonObject,
): Promise<{ id: string; taskId: string | null }> {
  const res = await fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function linkIssue(
  jar: CookieJar,
  token: string,
  entryId: string,
  remoteIssueId: string,
  cachedTitle: string,
): Promise<{ taskId: string }> {
  const res = await fetch(url('/api/time-entries/reassign'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({
      ids: [entryId],
      remoteIssueId,
      cachedTitle,
    }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
  return { taskId: body[0].taskId as string };
}

async function finalize(jar: CookieJar, token: string, body: JsonObject): Promise<Response> {
  return fetch(url('/api/sync/export'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

describeSyncExport('sync export finalization API', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  async function seedLinkedTask(jar: CookieJar, token: string, suffix: string) {
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });
    const tracker = await createTracker(jar, token, `Export Client ${suffix}`, {
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      executionMode: 'client',
      roundingRule: 'none',
    });
    const project = await createProject(jar, token, `Export Project ${suffix}`, tracker.id);
    const date = '2026-04-01';
    const entry = await createEntry(jar, token, {
      title: `Export Task ${suffix}`,
      projectId: project.id,
      startedAt: `${date}T10:00:00.000Z`,
      stoppedAt: `${date}T10:30:00.000Z`,
    });
    expect(entry.taskId).toBeTruthy();
    const linked = await linkIssue(jar, token, entry.id, '42', 'Linked issue');
    entry.taskId = linked.taskId;
    return { date, entry, tracker, project };
  }

  function withKey(body: JsonObject, key: string) {
    return { ...body, exportRequestKey: key };
  }

  it('finalizes a successful export and records provenance with the request key', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const { date, entry } = await seedLinkedTask(jar, token, String(Date.now()));
    const key = `er1|${entry.taskId}|${date}|${entry.id}|1800`;

    const res = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId: `log-${Date.now()}`,
          exportDurationSeconds: 1800,
          requiredFieldValues: { activity: '1' },
          entryIds: [entry.id],
        },
        key,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replayed).toBe(false);
    expect(body.entryIds).toEqual([entry.id]);
    expect(body.exportDurationSeconds).toBe(1800);
    expect(body.requiredFieldValues).toEqual({ activity: '1' });
    expect(body.exportRequestKey).toBe(key);

    const day = await (
      await fetch(url(`/api/sync/day?date=${date}`), { headers: { cookie: jar.header() } })
    ).json();
    const row = day.rows.find((r: { taskId: string }) => r.taskId === entry.taskId);
    expect(row.entries).toHaveLength(1);
    expect(row.entries[0].previouslyExported).toBe(true);
    expect(row.exports).toHaveLength(1);
    expect(row.exports[0].remoteLogId).toBe(body.remoteLogId);

    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const rows = await db.select().from(remoteExports).where(eq(remoteExports.id, body.exportId));
      expect(rows[0]?.exportRequestKey).toBe(key);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('reconciles repeated finalization with the same request key', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const { date, entry } = await seedLinkedTask(jar, token, `key-replay-${Date.now()}`);
    const key = `er1|same-key|${Date.now()}`;
    const remoteLogId = `key-log-${Date.now()}`;

    const first = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId,
          exportDurationSeconds: 1800,
          requiredFieldValues: { activity: '1' },
          entryIds: [entry.id],
        },
        key,
      ),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId: `other-${Date.now()}`,
          exportDurationSeconds: 9999,
          requiredFieldValues: { activity: '9' },
          entryIds: [entry.id],
        },
        key,
      ),
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.exportId).toBe(firstBody.exportId);
    expect(secondBody.remoteLogId).toBe(remoteLogId);
    expect(secondBody.exportDurationSeconds).toBe(1800);

    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const rows = await db
        .select()
        .from(remoteExports)
        .where(eq(remoteExports.exportRequestKey, key));
      expect(rows).toHaveLength(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('creates a separate record when the request key differs', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const { date, entry } = await seedLinkedTask(jar, token, `key-diff-${Date.now()}`);
    const stamp = Date.now();

    const first = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId: `first-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [entry.id],
        },
        `er1|diff-a|${stamp}`,
      ),
    );
    expect(first.status).toBe(200);

    const second = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId: `second-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [entry.id],
        },
        `er1|diff-b|${stamp}`,
      ),
    );
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.replayed).toBe(false);

    const day = await (
      await fetch(url(`/api/sync/day?date=${date}`), { headers: { cookie: jar.header() } })
    ).json();
    const row = day.rows.find((r: { taskId: string }) => r.taskId === entry.taskId);
    expect(row.exports).toHaveLength(2);
  });

  it('replays a known finalized remote log without creating another row', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const { date, entry } = await seedLinkedTask(jar, token, `replay-${Date.now()}`);
    const remoteLogId = `replay-log-${Date.now()}`;
    const stamp = Date.now();

    const first = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId,
          exportDurationSeconds: 1800,
          requiredFieldValues: { activity: '1' },
          entryIds: [entry.id],
        },
        `er1|replay-a|${stamp}`,
      ),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId,
          exportDurationSeconds: 9999,
          requiredFieldValues: { activity: '9' },
          entryIds: [entry.id],
        },
        `er1|replay-b|${stamp}`,
      ),
    );
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
    const { jar, token } = await seedAndLogin(dbUrl);
    const { date, entry } = await seedLinkedTask(jar, token, `repeat-${Date.now()}`);
    const stamp = Date.now();

    const first = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId: `first-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [entry.id],
        },
        `er1|repeat-a|${stamp}`,
      ),
    );
    expect(first.status).toBe(200);

    const second = await finalize(
      jar,
      token,
      withKey(
        {
          taskId: entry.taskId,
          localDate: date,
          remoteIssueId: '42',
          remoteLogId: `second-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [entry.id],
        },
        `er1|repeat-b|${stamp}`,
      ),
    );
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
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const seeded = await seedLinkedTask(alice.jar, alice.token, `reject-${Date.now()}`);

    const bobSeed = await seedLinkedTask(bob.jar, bob.token, `bob-${Date.now()}`);
    const stamp = Date.now();

    const foreign = await finalize(
      alice.jar,
      alice.token,
      withKey(
        {
          taskId: seeded.entry.taskId,
          localDate: seeded.date,
          remoteIssueId: '42',
          remoteLogId: `foreign-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [bobSeed.entry.id],
        },
        `er1|foreign|${stamp}`,
      ),
    );
    expect(foreign.status).toBe(422);

    const wrongIssue = await finalize(
      alice.jar,
      alice.token,
      withKey(
        {
          taskId: seeded.entry.taskId,
          localDate: seeded.date,
          remoteIssueId: '999',
          remoteLogId: `wrong-issue-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [seeded.entry.id],
        },
        `er1|wrong-issue|${stamp}`,
      ),
    );
    expect(wrongIssue.status).toBe(422);

    const wrongDay = await finalize(
      alice.jar,
      alice.token,
      withKey(
        {
          taskId: seeded.entry.taskId,
          localDate: '2026-04-02',
          remoteIssueId: '42',
          remoteLogId: `wrong-day-${stamp}`,
          exportDurationSeconds: 1800,
          entryIds: [seeded.entry.id],
        },
        `er1|wrong-day|${stamp}`,
      ),
    );
    expect(wrongDay.status).toBe(422);

    const invalid = await finalize(
      alice.jar,
      alice.token,
      withKey(
        {
          taskId: seeded.entry.taskId,
          localDate: seeded.date,
          remoteIssueId: '42',
          remoteLogId: `invalid-${stamp}`,
          exportDurationSeconds: 0,
          entryIds: [seeded.entry.id],
        },
        `er1|invalid|${stamp}`,
      ),
    );
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
    // Valid CSRF pair without a session reaches the handler as unauthenticated (401),
    // rather than being rejected earlier by CSRF protection (403).
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const res = await finalize(jar, token, {
      taskId: '01900000-0000-7000-8000-000000000001',
      localDate: '2026-04-01',
      remoteIssueId: '42',
      remoteLogId: '1',
      exportDurationSeconds: 60,
      entryIds: ['01900000-0000-7000-8000-0000000000aa'],
      exportRequestKey: 'er1|auth|test',
    });
    expect(res.status).toBe(401);
  });
});
