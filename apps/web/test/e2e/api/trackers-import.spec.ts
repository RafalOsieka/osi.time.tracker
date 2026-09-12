import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { CookieJar, primeCsrf } from '../helpers/auth';
import { seedAndLogin } from '../helpers/session';
import { createProject, createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { UNKNOWN_ID } from '../helpers/fixtures';
import type { JsonObject } from '@osi/remote-trackers/contracts';

const describeTrackersImport = requireDocker();

function importLog(overrides: JsonObject = {}): JsonObject {
  return {
    remoteLogId: `l-${Math.random().toString(36).slice(2)}`,
    remoteIssueId: '42',
    spentOn: '2026-04-01',
    durationSeconds: 3600,
    activityId: '1',
    comment: 'Fix rounding',
    ...overrides,
  };
}

async function postImport(
  jar: CookieJar,
  token: string,
  trackerId: string,
  body: JsonObject,
): Promise<Response> {
  return fetch(url(`/api/trackers/${trackerId}/import`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

async function setUtcTimezone(jar: CookieJar, token: string): Promise<void> {
  await fetch(url('/api/user/settings'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({ timezone: 'UTC' }),
  });
}

async function listTasks(jar: CookieJar, search: string) {
  const res = await fetch(url(`/api/tasks?search=${encodeURIComponent(search)}`), {
    headers: { cookie: jar.header() },
  });
  return res.json();
}

async function listEntries(jar: CookieJar, from: string, to: string) {
  const res = await fetch(url(`/api/time-entries?from=${from}&to=${to}`), {
    headers: { cookie: jar.header() },
  });
  return res.json();
}

async function createLocalEntry(
  jar: CookieJar,
  token: string,
  body: JsonObject,
): Promise<Response> {
  return fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

describeTrackersImport('tracker remote-log import API', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('dry run reports counts without persisting anything', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, `Import DryRun ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());

    const res = await postImport(jar, token, tracker.id, {
      dryRun: true,
      groups: [
        {
          projectId: project.id,
          logs: [
            importLog({ remoteLogId: `dry-a-${suffix}`, comment: `Dry run task ${suffix}` }),
            importLog({ remoteLogId: `dry-b-${suffix}`, comment: `Dry run task ${suffix}` }),
          ],
        },
      ],
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.dryRun).toBe(true);
    expect(result.totalImported).toBe(0);
    expect(result.totalWouldImport).toBe(2);
    expect(result.totalSkippedExisting).toBe(0);
    expect(result.projects).toEqual([
      { projectId: project.id, imported: 0, wouldImport: 2, skippedExisting: 0 },
    ]);

    const tasks = await listTasks(jar, `Dry run task ${suffix}`);
    expect(tasks).toHaveLength(0);
  });

  it('writes a task, a stopped entry stacked from 08:00, and provenance; reuses the task across days', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import Write ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());
    const comment = `Fix rounding ${suffix}`;

    const res = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [
            importLog({
              remoteLogId: `day1-${suffix}`,
              spentOn: '2026-04-01',
              durationSeconds: 3600,
              comment,
              remoteIssueTitle: 'Ship it',
            }),
            importLog({
              remoteLogId: `day2-${suffix}`,
              spentOn: '2026-04-02',
              durationSeconds: 1800,
              comment,
            }),
          ],
        },
      ],
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.dryRun).toBe(false);
    expect(result.totalImported).toBe(2);
    expect(result.totalSkippedExisting).toBe(0);

    const tasks = await listTasks(jar, comment);
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task.projectId).toBe(project.id);
    expect(task.remoteIssueRef.remoteIssueId).toBe('42');
    expect(task.remoteIssueRef.cachedTitle).toBe('Ship it');

    const entries: { taskId: string | null; startedAt: string; stoppedAt: string }[] =
      await listEntries(jar, '2026-04-01T00:00:00.000Z', '2026-04-03T00:00:00.000Z');
    const own = entries.filter((e) => e.taskId === task.id);
    expect(own).toHaveLength(2);
    const day1 = own.find((e) => e.startedAt.startsWith('2026-04-01'));
    expect(day1).toBeDefined();
    expect(day1?.startedAt).toBe('2026-04-01T08:00:00.000Z');
    expect(day1?.stoppedAt).toBe('2026-04-01T09:00:00.000Z');
    const day2 = own.find((e) => e.startedAt.startsWith('2026-04-02'));
    expect(day2).toBeDefined();
    expect(day2?.startedAt).toBe('2026-04-02T08:00:00.000Z');
    expect(day2?.stoppedAt).toBe('2026-04-02T08:30:00.000Z');
  });

  it('places an imported entry after a real local entry already on that day (existingMaxStop from the DB)', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import ExistingEntry ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());
    const date = '2026-04-10';

    const localRes = await createLocalEntry(jar, token, {
      title: `Real local work ${suffix}`,
      startedAt: `${date}T09:00:00.000Z`,
      stoppedAt: `${date}T10:30:00.000Z`,
    });
    expect(localRes.status).toBe(200);

    const res = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [
            importLog({
              remoteLogId: `existing-${suffix}`,
              spentOn: date,
              durationSeconds: 3600,
              comment: `After real entry ${suffix}`,
            }),
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).totalImported).toBe(1);

    const entries: { taskName: string | null; startedAt: string; stoppedAt: string }[] =
      await listEntries(jar, `${date}T00:00:00.000Z`, '2026-04-11T00:00:00.000Z');
    const imported = entries.find((e) => e.taskName === `After real entry ${suffix}`);
    expect(imported).toBeDefined();
    // The real local entry ends at 10:30 UTC, past the 08:00 anchor, so the
    // imported entry must start after it, not overlap it.
    expect(imported?.startedAt).toBe(`${date}T10:30:00.000Z`);
    expect(imported?.stoppedAt).toBe(`${date}T11:30:00.000Z`);
  });

  it('places a second import request after the first request on the same day (existingMaxStop from a prior import)', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import SecondRun ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());
    const date = '2026-04-12';

    const first = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [
            importLog({
              remoteLogId: `second-run-a-${suffix}`,
              spentOn: date,
              durationSeconds: 3600,
              comment: `First run task ${suffix}`,
            }),
          ],
        },
      ],
    });
    expect((await first.json()).totalImported).toBe(1);

    const second = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [
            importLog({
              remoteLogId: `second-run-b-${suffix}`,
              spentOn: date,
              durationSeconds: 1800,
              comment: `Second run task ${suffix}`,
            }),
          ],
        },
      ],
    });
    expect(second.status).toBe(200);
    expect((await second.json()).totalImported).toBe(1);

    const entries: { taskName: string | null; startedAt: string; stoppedAt: string }[] =
      await listEntries(jar, `${date}T00:00:00.000Z`, '2026-04-13T00:00:00.000Z');
    const firstEntry = entries.find((e) => e.taskName === `First run task ${suffix}`);
    const secondEntry = entries.find((e) => e.taskName === `Second run task ${suffix}`);
    expect(firstEntry?.startedAt).toBe(`${date}T08:00:00.000Z`);
    expect(firstEntry?.stoppedAt).toBe(`${date}T09:00:00.000Z`);
    // The second request's own DB query must see the first request's already
    // -committed entry and place after it, not overlap it.
    expect(secondEntry?.startedAt).toBe(`${date}T09:00:00.000Z`);
    expect(secondEntry?.stoppedAt).toBe(`${date}T09:30:00.000Z`);
  });

  it('creates sibling tasks for the same issue with different comments, and "empty" for a blank one', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import Siblings ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());

    const res = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [
            importLog({
              remoteLogId: `sib-a-${suffix}`,
              remoteIssueId: `sib-${suffix}`,
              comment: `Comment A ${suffix}`,
            }),
            importLog({
              remoteLogId: `sib-b-${suffix}`,
              remoteIssueId: `sib-${suffix}`,
              comment: `Comment B ${suffix}`,
            }),
            importLog({
              remoteLogId: `sib-c-${suffix}`,
              remoteIssueId: `sib-${suffix}`,
              comment: null,
            }),
          ],
        },
      ],
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.totalImported).toBe(3);

    const taskA = await listTasks(jar, `Comment A ${suffix}`);
    const taskB = await listTasks(jar, `Comment B ${suffix}`);
    expect(taskA).toHaveLength(1);
    expect(taskB).toHaveLength(1);
    expect(taskA[0].id).not.toBe(taskB[0].id);
    expect(taskA[0].remoteIssueRef.remoteIssueId).toBe(`sib-${suffix}`);
    expect(taskB[0].remoteIssueRef.remoteIssueId).toBe(`sib-${suffix}`);

    const emptyTasks = await listTasks(jar, 'empty');
    expect(emptyTasks.some((t: { name: string }) => t.name === 'empty')).toBe(true);
  });

  it('re-running the same import skips every already-imported log', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import Rerun ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());
    const body = {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [importLog({ remoteLogId: `rerun-${suffix}`, comment: `Rerun task ${suffix}` })],
        },
      ],
    };

    const first = await postImport(jar, token, tracker.id, body);
    expect((await first.json()).totalImported).toBe(1);

    const second = await postImport(jar, token, tracker.id, body);
    const secondResult = await second.json();
    expect(secondResult.totalImported).toBe(0);
    expect(secondResult.totalSkippedExisting).toBe(1);

    const tasks = await listTasks(jar, `Rerun task ${suffix}`);
    expect(tasks).toHaveLength(1);
  });

  it('skips a log already covered by provenance from another tracker-scoped source', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import Shared ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());
    const remoteLogId = `shared-${suffix}`;

    // Simulate a log the app already exported/imported earlier through any
    // path: the skip mechanism keys only on (userId, trackerId, remoteLogId).
    const seeded = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        { projectId: project.id, logs: [importLog({ remoteLogId, comment: `Seed ${suffix}` })] },
      ],
    });
    expect((await seeded.json()).totalImported).toBe(1);

    const reimport = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [importLog({ remoteLogId, comment: `Different comment ${suffix}` })],
        },
      ],
    });
    const result = await reimport.json();
    expect(result.totalImported).toBe(0);
    expect(result.totalSkippedExisting).toBe(1);

    const differentTask = await listTasks(jar, `Different comment ${suffix}`);
    expect(differentTask).toHaveLength(0);
  });

  it('re-imports a log once its provenance is deleted, exactly like a deleted export (REQ-344)', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    await setUtcTimezone(jar, token);
    const tracker = await createTracker(jar, token, `Import Deleted ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);
    const suffix = String(Date.now());
    const date = '2026-04-15';
    const comment = `Deleted then reimported ${suffix}`;
    const remoteLogId = `deleted-${suffix}`;
    const body = {
      dryRun: false,
      groups: [
        { projectId: project.id, logs: [importLog({ remoteLogId, spentOn: date, comment })] },
      ],
    };

    const first = await postImport(jar, token, tracker.id, body);
    expect((await first.json()).totalImported).toBe(1);

    const tasks = await listTasks(jar, comment);
    expect(tasks).toHaveLength(1);
    const taskId = tasks[0].id;

    const day = await (
      await fetch(url(`/api/sync/day?date=${date}`), { headers: { cookie: jar.header() } })
    ).json();
    const row = day.rows.find((r: { taskId: string | null }) => r.taskId === taskId);
    expect(row).toBeDefined();
    const exportRow = row.exports.find(
      (e: { remoteLogId: string }) => e.remoteLogId === remoteLogId,
    );
    expect(exportRow).toBeDefined();

    const deleted = await fetch(url('/api/sync/export'), {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ exportId: exportRow.exportId }),
    });
    expect(deleted.status).toBe(200);

    // Re-running the same import (as the range fetch would after the log was
    // deleted through the confirmed-deletion flow) recreates it as new,
    // rather than skipping it as already-existing.
    const second = await postImport(jar, token, tracker.id, body);
    const secondResult = await second.json();
    expect(secondResult.totalImported).toBe(1);
    expect(secondResult.totalSkippedExisting).toBe(0);
  });

  it('rejects a project bound to a different tracker without persisting anything', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const trackerA = await createTracker(jar, token, `Import TrackerA ${Date.now()}`);
    const trackerB = await createTracker(jar, token, `Import TrackerB ${Date.now()}`);
    const projectB = await createProject(jar, token, `Import ProjectB ${Date.now()}`, trackerB.id);
    const suffix = String(Date.now());

    const res = await postImport(jar, token, trackerA.id, {
      dryRun: false,
      groups: [
        {
          projectId: projectB.id,
          logs: [importLog({ remoteLogId: `wrong-tracker-${suffix}` })],
        },
      ],
    });

    expect(res.status).toBe(422);
    expect((await res.json())?.data?.messageKey).toBe('error.remoteLogImportProjectNotBound');

    const tasks = await listTasks(jar, 'Fix rounding');
    expect(
      tasks.filter((t: { projectId: string | null }) => t.projectId === projectB.id),
    ).toHaveLength(0);
  });

  it('rejects a local project (no tracker) the same way', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, `Import LocalProj ${Date.now()}`);
    const localProject = await createProject(jar, token, `Import Local ${Date.now()}`, null);

    const res = await postImport(jar, token, tracker.id, {
      dryRun: false,
      groups: [{ projectId: localProject.id, logs: [importLog()] }],
    });

    expect(res.status).toBe(422);
    expect((await res.json())?.data?.messageKey).toBe('error.remoteLogImportProjectNotBound');
  });

  it('rejects a foreign or unknown tracker id without revealing existence', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const aliceTracker = await createTracker(alice.jar, alice.token, `Import Alice ${Date.now()}`);
    const aliceProject = await createProject(
      alice.jar,
      alice.token,
      `Import AliceProj ${Date.now()}`,
      aliceTracker.id,
    );

    const foreign = await postImport(bob.jar, bob.token, aliceTracker.id, {
      dryRun: true,
      groups: [{ projectId: aliceProject.id, logs: [importLog()] }],
    });
    expect(foreign.status).toBe(404);

    const unknown = await postImport(alice.jar, alice.token, UNKNOWN_ID, {
      dryRun: true,
      groups: [{ projectId: aliceProject.id, logs: [importLog()] }],
    });
    expect(unknown.status).toBe(404);
  });

  it('rejects a malformed body: empty groups, duplicate remote log ids, non-positive duration', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, `Import Invalid ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);

    const emptyGroups = await postImport(jar, token, tracker.id, { dryRun: true, groups: [] });
    expect(emptyGroups.status).toBe(422);

    const duplicateIds = await postImport(jar, token, tracker.id, {
      dryRun: true,
      groups: [
        { projectId: project.id, logs: [importLog({ remoteLogId: 'dup' })] },
        { projectId: project.id, logs: [importLog({ remoteLogId: 'dup' })] },
      ],
    });
    expect(duplicateIds.status).toBe(422);

    const badDuration = await postImport(jar, token, tracker.id, {
      dryRun: true,
      groups: [{ projectId: project.id, logs: [importLog({ durationSeconds: 0 })] }],
    });
    expect(badDuration.status).toBe(422);
  });

  it('rejects a mutating request without a valid CSRF token', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);
    const tracker = await createTracker(jar, token, `Import NoCsrf ${Date.now()}`);
    const project = await createProject(jar, token, `Import Project ${Date.now()}`, tracker.id);

    const res = await fetch(url(`/api/trackers/${tracker.id}/import`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: jar.header() },
      body: JSON.stringify({
        dryRun: true,
        groups: [{ projectId: project.id, logs: [importLog()] }],
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const anonJar = new CookieJar();
    const anonToken = await primeCsrf(anonJar);
    const unauthenticated = await postImport(anonJar, anonToken, tracker.id, {
      dryRun: true,
      groups: [{ projectId: project.id, logs: [importLog()] }],
    });
    expect(unauthenticated.status).toBe(401);
  });
});
