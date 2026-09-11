import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import type { CookieJar } from '../helpers/auth';
import { seedAndLogin } from '../helpers/session';
import { createProject, createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { createDatabaseClient } from '../../../server/db/client';
import { remoteExportEntries, remoteExports } from '../../../server/db/schema';
import { eq } from 'drizzle-orm';
import type { JsonObject } from '@osi/remote-trackers/contracts';

const describeSyncLink = requireDocker();

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
): Promise<{ taskId: string }> {
  const res = await fetch(url('/api/time-entries/reassign'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ ids: [entryId], remoteIssueId: '42', cachedTitle: 'Linked issue' }),
  });
  expect(res.status).toBe(200);
  const body: { taskId: string | null }[] = await res.json();
  const taskId = body[0]?.taskId;
  if (!taskId) throw new Error('expected taskId from reassign');
  return { taskId };
}

describeSyncLink('sync remote-entry link and cleanup API', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  async function seedLinkedTask(jar: CookieJar, token: string, suffix: string) {
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: 'UTC' }),
    });
    const tracker = await createTracker(jar, token, `Link Client ${suffix}`, {
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      directBrowserAccess: true,
      roundingRule: 'none',
    });
    const project = await createProject(jar, token, `Link Project ${suffix}`, tracker.id);
    const date = '2026-04-01';
    const entry = await createEntry(jar, token, {
      title: `Link Task ${suffix}`,
      projectId: project.id,
      startedAt: `${date}T10:00:00.000Z`,
      stoppedAt: `${date}T10:30:00.000Z`,
    });
    const linked = await linkIssue(jar, token, entry.id);
    return { date, entry: { ...entry, taskId: linked.taskId }, tracker, project };
  }

  function linkBody(
    seed: Awaited<ReturnType<typeof seedLinkedTask>>,
    overrides: JsonObject = {},
  ): JsonObject {
    return {
      taskId: seed.entry.taskId,
      trackerId: seed.tracker.id,
      localDate: seed.date,
      spentOn: seed.date,
      remoteIssueId: '42',
      remoteLogId: `link-${Date.now()}`,
      exportDurationSeconds: 999,
      requiredFieldValues: { activity: '1' },
      ...overrides,
    };
  }

  async function postLink(jar: CookieJar, token: string, body: JsonObject) {
    return fetch(url('/api/sync/link'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(body),
    });
  }

  async function deleteExport(jar: CookieJar, token: string, exportId: string) {
    return fetch(url('/api/sync/export'), {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ exportId }),
    });
  }

  it('links an unlinked entry covering all completed entries and preserves remote duration', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const seed = await seedLinkedTask(jar, token, String(Date.now()));
    const res = await postLink(jar, token, linkBody(seed, { remoteLogId: `dur-${Date.now()}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exportDurationSeconds).toBe(999);
    expect(body.entryIds).toEqual([seed.entry.id]);
    expect(body.trackerId).toBe(seed.tracker.id);

    const day = await (
      await fetch(url(`/api/sync/day?date=${seed.date}`), { headers: { cookie: jar.header() } })
    ).json();
    const row = day.rows.find((item: { taskId: string }) => item.taskId === seed.entry.taskId);
    expect(row.exports[0].exportDurationSeconds).toBe(999);
  });

  it('rejects duplicate identity, ownership, issue/date mismatch, and existing provenance', async () => {
    const alice = await seedAndLogin(dbUrl);
    const seed = await seedLinkedTask(alice.jar, alice.token, `dup-${Date.now()}`);
    const remoteLogId = `dup-log-${Date.now()}`;
    const first = await postLink(alice.jar, alice.token, linkBody(seed, { remoteLogId }));
    expect(first.status).toBe(200);

    const duplicate = await postLink(alice.jar, alice.token, linkBody(seed, { remoteLogId }));
    expect(duplicate.status).toBe(422);
    expect((await duplicate.json())?.data?.messageKey).toBe('error.remoteExportAlreadyLinked');

    const otherDay = await postLink(
      alice.jar,
      alice.token,
      linkBody(seed, { remoteLogId: `other-${Date.now()}`, spentOn: '2026-04-02' }),
    );
    expect(otherDay.status).toBe(422);
    expect((await otherDay.json())?.data?.messageKey).toBe('error.remoteExportLinkMismatch');

    const issue = await postLink(
      alice.jar,
      alice.token,
      linkBody(seed, { remoteLogId: `issue-${Date.now()}`, remoteIssueId: '99' }),
    );
    expect(issue.status).toBe(422);
    expect((await issue.json())?.data?.messageKey).toBe('error.remoteExportLinkMismatch');

    const bob = await seedAndLogin(dbUrl);
    const foreign = await postLink(
      bob.jar,
      bob.token,
      linkBody(seed, { remoteLogId: `bob-${Date.now()}` }),
    );
    expect(foreign.status).toBe(404);

    const already = await seedLinkedTask(alice.jar, alice.token, `exist-${Date.now()}`);
    await postLink(
      alice.jar,
      alice.token,
      linkBody(already, { remoteLogId: `exist-${Date.now()}` }),
    );
    const secondDay = await postLink(
      alice.jar,
      alice.token,
      linkBody(already, { remoteLogId: `exist2-${Date.now()}` }),
    );
    expect(secondDay.status).toBe(422);
    expect((await secondDay.json())?.data?.messageKey).toBe('error.remoteExportAlreadyFinalized');
  });

  it('removes provenance and entry links atomically and rejects foreign cleanup', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const seed = await seedLinkedTask(jar, token, `clean-${Date.now()}`);
    const linked = await postLink(
      jar,
      token,
      linkBody(seed, { remoteLogId: `clean-${Date.now()}` }),
    );
    const body = await linked.json();

    const cleaned = await deleteExport(jar, token, body.exportId);
    expect(cleaned.status).toBe(200);
    expect(await cleaned.json()).toEqual({ exportId: body.exportId, cleaned: true });

    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const exports = await db
        .select()
        .from(remoteExports)
        .where(eq(remoteExports.id, body.exportId));
      const links = await db
        .select()
        .from(remoteExportEntries)
        .where(eq(remoteExportEntries.exportId, body.exportId));
      expect(exports).toHaveLength(0);
      expect(links).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 5 });
    }

    const again = await deleteExport(jar, token, body.exportId);
    expect(again.status).toBe(404);

    const other = await seedAndLogin(dbUrl);
    const owned = await seedLinkedTask(other.jar, other.token, `foreign-${Date.now()}`);
    const ownedLink = await postLink(
      other.jar,
      other.token,
      linkBody(owned, { remoteLogId: `foreign-${Date.now()}` }),
    );
    const ownedBody = await ownedLink.json();
    const stolen = await deleteExport(jar, token, ownedBody.exportId);
    expect(stolen.status).toBe(404);
  });
});
