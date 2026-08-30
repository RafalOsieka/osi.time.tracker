import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { seedAndLogin } from '../helpers/session';
import { createProject, createTracker } from '../helpers/http';
import type { CookieJar } from '../helpers/auth';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { createDatabaseClient } from '../../../server/db/client';
import { remoteExports } from '../../../server/db/schema';
import type { JsonObject } from '../../../shared/types/json';

const describeReportsMonthly = requireDocker();

async function setTimezone(jar: CookieJar, token: string, timezone: string): Promise<void> {
  await fetch(url('/api/user/settings'), {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'csrf-token': token,
      cookie: jar.header(),
    },
    body: JSON.stringify({ timezone }),
  });
}

async function createStoppedEntry(
  jar: CookieJar,
  token: string,
  body: JsonObject,
): Promise<{ id: string; taskId: string | null }> {
  const created = await fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'csrf-token': token,
      cookie: jar.header(),
    },
    body: JSON.stringify(body),
  });
  expect(created.status).toBe(200);
  return created.json();
}

describeReportsMonthly('monthly report API', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('returns 401 when unauthenticated', async () => {
    const res = await fetch(url('/api/reports/monthly?month=2026-08'));
    expect(res.status).toBe(401);
  });

  it('returns 422 for an invalid month', async () => {
    const { jar } = await seedAndLogin(dbUrl);
    const res = await fetch(url('/api/reports/monthly?month=2026-13'), {
      headers: { cookie: jar.header() },
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body?.data?.messageKey).toBe('error.reportMonthInvalid');
  });

  it('aggregates local hours, exports, and active trackers, isolating users', async () => {
    const user = await seedAndLogin(dbUrl);
    const other = await seedAndLogin(dbUrl);
    await setTimezone(user.jar, user.token, 'UTC');
    await setTimezone(other.jar, other.token, 'UTC');

    const tracker = await createTracker(user.jar, user.token, 'Report Tracker ' + Date.now());
    const unused = await createTracker(user.jar, user.token, 'Unused Tracker ' + Date.now());
    const deleted = await createTracker(user.jar, user.token, 'Deleted Tracker ' + Date.now());
    await fetch(url(`/api/trackers/${deleted.id}`), {
      method: 'DELETE',
      headers: { 'csrf-token': user.token, cookie: user.jar.header() },
    });
    const project = await createProject(
      user.jar,
      user.token,
      'Report Project ' + Date.now(),
      tracker.id,
    );

    const stopped = await createStoppedEntry(user.jar, user.token, {
      title: 'Logged work',
      projectId: project.id,
      startedAt: '2026-08-03T10:00:00.000Z',
      stoppedAt: '2026-08-03T12:00:00.000Z',
    });
    await createStoppedEntry(user.jar, user.token, {
      title: 'Running later',
    });
    await createStoppedEntry(other.jar, other.token, {
      title: 'Other user',
      startedAt: '2026-08-03T10:00:00.000Z',
      stoppedAt: '2026-08-03T11:00:00.000Z',
    });

    const { db, sql } = createDatabaseClient(dbUrl);
    try {
      await db.insert(remoteExports).values({
        userId: user.id,
        taskId: stopped.taskId,
        localDate: '2026-08-03',
        remoteIssueId: '42',
        remoteLogId: 'log-11',
        exportDurationSeconds: 7200,
        requiredFieldValues: {},
        exportRequestKey: `er-report-${Date.now()}`,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }

    const res = await fetch(url('/api/reports/monthly?month=2026-08'), {
      headers: { cookie: user.jar.header() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.month).toBe('2026-08');
    expect(body.timezone).toBe('UTC');
    expect(body.days).toEqual([{ date: '2026-08-03', localSeconds: 2 * 3600 }]);
    expect(body.exports).toEqual([
      {
        localDate: '2026-08-03',
        remoteLogId: 'log-11',
        exportDurationSeconds: 7200,
      },
    ]);
    const trackerNames = body.trackers.map((row: { name: string }) => row.name);
    expect(trackerNames).toContain(tracker.name);
    expect(trackerNames).toContain(unused.name);
    expect(trackerNames).not.toContain(deleted.name);
  });
});
