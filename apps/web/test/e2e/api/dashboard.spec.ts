import type { JsonObject } from '@osi/time-tracker-remote-trackers/contracts';
import { Temporal } from 'temporal-polyfill';
import { expect, it } from 'vitest';
import type { DashboardDto, DashboardGroupDto } from '../../../shared/types/dashboard';
import type { TimeEntryDto } from '../../../shared/types/time-entry';
import { type CookieJar, patchTimezone } from '../helpers/auth';
import { createProject, createTracker, reassignEntries, startEntry } from '../helpers/http';
import { zoneAwayFromMidnight } from '../helpers/fixtures';
import { type SeededSession, seedAndLogin } from '../helpers/session';
import { url } from '../helpers/url';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';

const describeDashboard = requireDocker();

const NO_TIME = { totalSeconds: 0, daysWithEntries: 0, averageSeconds: 0 };

function requestDashboard(jar: CookieJar, query = ''): Promise<Response> {
  return fetch(url(`/api/dashboard${query}`), { headers: { cookie: jar.header() } });
}

async function getDashboard(jar: CookieJar, query = ''): Promise<DashboardDto> {
  const res = await requestDashboard(jar, query);
  expect(res.status).toBe(200);
  return res.json();
}

/** A group with its total, without the split over buckets and its color. */
function withoutBuckets({
  bucketSeconds: _bucketSeconds,
  colorSlot: _colorSlot,
  ...group
}: DashboardGroupDto) {
  return group;
}

/** Each group's color slot, by id or kind. */
function colorSlots(groups: readonly DashboardGroupDto[]) {
  return Object.fromEntries(
    groups.map((group) => ['id' in group ? group.id : group.kind, group.colorSlot]),
  );
}

/** The buckets of a group that hold time. */
function timeByBucket({ buckets }: DashboardDto, group: DashboardGroupDto | undefined) {
  const seconds = buckets.map((bucket, index) => [bucket, group?.bucketSeconds[index]] as const);
  return Object.fromEntries(seconds.filter(([, value]) => value !== 0));
}

/** Today in `timeZone`, from a source independent of the server's date math. */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(new Date());
}

describeDashboard('dashboard API', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  async function userIn(timezone: string): Promise<SeededSession> {
    const user = await seedAndLogin(dbUrl);
    await patchTimezone(user.jar, user.token, timezone);
    return user;
  }

  async function logTime(
    user: SeededSession,
    startedAt: string,
    stoppedAt: string,
    task: { title?: string; projectId?: string } = { title: 'Work' },
  ): Promise<TimeEntryDto> {
    const res = await startEntry(user.jar, user.token, { ...task, startedAt, stoppedAt });
    expect(res.status).toBe(200);
    return res.json();
  }

  /**
   * Links the entry's day to a Remote issue, which moves the entry to the Task carrying it, and
   * returns that Task.
   */
  async function linkIssue(
    user: SeededSession,
    entry: TimeEntryDto,
    remoteIssueId: string,
  ): Promise<string> {
    const res = await reassignEntries(user.jar, user.token, {
      ids: [entry.id],
      remoteIssueId,
      cachedTitle: `Issue ${remoteIssueId}`,
    });
    expect(res.status).toBe(200);
    const [moved]: TimeEntryDto[] = await res.json();
    if (!moved?.taskId) throw new Error('Linking left the entry without a Task');
    return moved.taskId;
  }

  async function post(user: SeededSession, path: string, body: JsonObject) {
    const res = await fetch(url(path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': user.token,
        cookie: user.jar.header(),
      },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
  }

  async function remove(user: SeededSession, path: string) {
    const res = await fetch(url(path), {
      method: 'DELETE',
      headers: { 'csrf-token': user.token, cookie: user.jar.header() },
    });
    expect(res.status).toBe(200);
  }

  it('returns 401 when unauthenticated', async () => {
    const res = await fetch(url('/api/dashboard'));
    expect(res.status).toBe(401);
  });

  it.each([
    ['?period=day', 'error.dashboardPeriodInvalid'],
    ['?period=', 'error.dashboardPeriodInvalid'],
    ['?period=week&period=month', 'error.dashboardPeriodInvalid'],
    ['?date=2026-02-30', 'error.dashboardDateInvalid'],
    ['?date=2026-02', 'error.dashboardDateInvalid'],
    ['?date=', 'error.dashboardDateInvalid'],
    ['?period=year&date=0000-01-01', 'error.dashboardDateInvalid'],
    ['?period=week&date=9999-12-31', 'error.dashboardDateInvalid'],
  ])('returns 422 for %s', async (query, messageKey) => {
    const { jar } = await seedAndLogin(dbUrl);
    const res = await requestDashboard(jar, query);
    expect(res.status).toBe(422);
    expect((await res.json()).data).toEqual({ messageKey });
  });

  it.each(['0002-01-01', '9998-12-31'])('answers for the outermost date %s', async (date) => {
    const { jar } = await userIn('Pacific/Kiritimati');
    for (const period of ['week', 'month', 'year']) {
      const body = await getDashboard(jar, `?period=${period}&date=${date}`);
      expect(body.summary).toEqual(NO_TIME);
    }
  });

  // Between them these two are never on the same day, so one differs from the server's own.
  it.each(['Pacific/Pago_Pago', 'Pacific/Kiritimati'])(
    'defaults to the month containing today in %s',
    async (timezone) => {
      const { jar } = await userIn(timezone);
      const before = todayIn(timezone);
      const body = await getDashboard(jar);
      expect([before, todayIn(timezone)]).toContain(body.today);
      expect(body.timezone).toBe(timezone);
      expect(body.period.kind).toBe('month');
      expect(body.period.firstDay).toBe(`${body.today.slice(0, 7)}-01`);
    },
  );

  it.each([
    ['Europe/Warsaw', 1, '2026-08-03', '2026-08-09'],
    ['America/New_York', 7, '2026-08-02', '2026-08-08'],
    ['UTC', 1, '2026-08-03', '2026-08-09'],
  ])('starts a week in %s on day %i', async (timezone, firstDayOfWeek, firstDay, lastDay) => {
    const { jar } = await userIn(timezone);
    const body = await getDashboard(jar, '?period=week&date=2026-08-05');
    expect(body.firstDayOfWeek).toBe(firstDayOfWeek);
    expect(body.period).toEqual({ kind: 'week', firstDay, lastDay });
  });

  it('resolves the month and the year containing the date', async () => {
    const { jar } = await userIn('UTC');
    const month = await getDashboard(jar, '?date=2024-02-10');
    expect(month.period).toEqual({ kind: 'month', firstDay: '2024-02-01', lastDay: '2024-02-29' });
    const year = await getDashboard(jar, '?period=year&date=2024-02-10');
    expect(year.period).toEqual({ kind: 'year', firstDay: '2024-01-01', lastDay: '2024-12-31' });
  });

  it('sums completed entries on the local day of their start', async () => {
    const user = await userIn('Europe/Warsaw');
    // Aug 3: 1:30 + 0:30; Aug 31: 2:00 crossing midnight into September.
    await logTime(user, '2026-08-03T08:00:00.000Z', '2026-08-03T09:30:00.000Z');
    await logTime(user, '2026-08-03T12:00:00.000Z', '2026-08-03T12:30:00.000Z');
    await logTime(user, '2026-08-31T21:30:00.000Z', '2026-08-31T23:30:00.000Z');
    // 00:30 on September 1 in Warsaw, still August in UTC.
    await logTime(user, '2026-08-31T22:30:00.000Z', '2026-08-31T22:45:00.000Z');

    expect((await getDashboard(user.jar, '?date=2026-08-15')).summary).toEqual({
      totalSeconds: 4 * 3600,
      daysWithEntries: 2,
      averageSeconds: 2 * 3600,
    });
    expect((await getDashboard(user.jar, '?date=2026-09-15')).summary).toEqual({
      totalSeconds: 15 * 60,
      daysWithEntries: 1,
      averageSeconds: 15 * 60,
    });
  });

  it('ends the period at midnight when its last day starts at 01:00', async () => {
    // Clocks in Cairo skip midnight on April 24, 2026, the last day of a week there.
    const user = await userIn('Africa/Cairo');
    await logTime(user, '2026-04-24T20:30:00.000Z', '2026-04-24T20:45:00.000Z');
    await logTime(user, '2026-04-24T21:30:00.000Z', '2026-04-24T22:30:00.000Z');
    const week = await getDashboard(user.jar, '?period=week&date=2026-04-24');
    expect(week.period.lastDay).toBe('2026-04-24');
    expect(week.summary).toEqual({ totalSeconds: 900, daysWithEntries: 1, averageSeconds: 900 });
  });

  it('does not count a day whose only entry is shorter than a second', async () => {
    const user = await userIn('UTC');
    await logTime(user, '2026-08-03T08:00:00.000Z', '2026-08-03T09:00:00.000Z');
    await logTime(user, '2026-08-04T08:00:00.000Z', '2026-08-04T08:00:00.500Z');
    const { summary } = await getDashboard(user.jar, '?date=2026-08-01');
    expect(summary).toEqual({ totalSeconds: 3600, daysWithEntries: 1, averageSeconds: 3600 });
  });

  it('rounds the average to whole seconds', async () => {
    const user = await userIn('UTC');
    await logTime(user, '2026-08-03T08:00:00.000Z', '2026-08-03T08:00:01.000Z');
    await logTime(user, '2026-08-04T08:00:00.000Z', '2026-08-04T08:00:01.000Z');
    await logTime(user, '2026-08-05T08:00:00.000Z', '2026-08-05T08:00:03.000Z');
    const { summary } = await getDashboard(user.jar, '?date=2026-08-01');
    expect(summary).toEqual({ totalSeconds: 5, daysWithEntries: 3, averageSeconds: 2 });
  });

  it('leaves the running entry out', async () => {
    const user = await userIn('UTC');
    expect((await startEntry(user.jar, user.token, { title: 'Running' })).status).toBe(200);
    const body = await getDashboard(user.jar, '?period=year');
    expect(body.summary).toEqual(NO_TIME);
    expect(body.groups).toEqual({ project: [], tracker: [] });
    expect(body.topTasks).toEqual([]);
    expect(body.hasEntries).toBe(true);
  });

  it('tells an empty account from an empty period', async () => {
    const user = await userIn('UTC');
    const emptyAccount = await getDashboard(user.jar, '?date=2026-08-01');
    expect(emptyAccount.hasEntries).toBe(false);
    expect(emptyAccount.summary).toEqual(NO_TIME);

    await logTime(user, '2026-08-03T08:00:00.000Z', '2026-08-03T09:00:00.000Z');
    const emptyPeriod = await getDashboard(user.jar, '?date=2026-07-01');
    expect(emptyPeriod.hasEntries).toBe(true);
    expect(emptyPeriod.summary).toEqual(NO_TIME);
  });

  it('groups the time by Project and by Tracker, largest first', async () => {
    const user = await userIn('UTC');
    const { jar, token } = user;
    const tracker = await createTracker(jar, token, 'Redmine');
    const site = await createProject(jar, token, 'Site', tracker.id);
    const shop = await createProject(jar, token, 'Shop', tracker.id);
    const books = await createProject(jar, token, 'Books');
    const house = await createProject(jar, token, 'House');
    const title = 'Work';
    await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T09:00:00Z', {
      title,
      projectId: shop.id,
    });
    await logTime(user, '2026-08-03T09:00:00Z', '2026-08-03T11:00:00Z', {
      title,
      projectId: site.id,
    });
    await logTime(user, '2026-08-04T08:00:00Z', '2026-08-04T09:00:00Z', {
      title: 'Other work',
      projectId: site.id,
    });
    await logTime(user, '2026-08-05T08:00:00Z', '2026-08-05T09:30:00Z', {
      title,
      projectId: books.id,
    });
    await logTime(user, '2026-08-05T10:00:00Z', '2026-08-05T12:00:00Z', {
      title,
      projectId: house.id,
    });
    // A Task without a Project and an entry without a Task.
    await logTime(user, '2026-08-06T08:00:00Z', '2026-08-06T10:00:00Z', { title });
    await logTime(user, '2026-08-06T10:00:00Z', '2026-08-06T10:15:00Z', {});

    const { groups, summary } = await getDashboard(jar, '?date=2026-08-01');
    expect(groups.project.map(withoutBuckets)).toEqual([
      { kind: 'project', id: site.id, name: 'Site', deleted: false, totalSeconds: 10_800 },
      { kind: 'noProject', totalSeconds: 8100 },
      { kind: 'project', id: house.id, name: 'House', deleted: false, totalSeconds: 7200 },
      { kind: 'project', id: books.id, name: 'Books', deleted: false, totalSeconds: 5400 },
      { kind: 'project', id: shop.id, name: 'Shop', deleted: false, totalSeconds: 3600 },
    ]);
    expect(groups.tracker.map(withoutBuckets)).toEqual([
      { kind: 'tracker', id: tracker.id, name: 'Redmine', deleted: false, totalSeconds: 14_400 },
      { kind: 'local', totalSeconds: 12_600 },
      { kind: 'noProject', totalSeconds: 8100 },
    ]);
    expect(summary.totalSeconds).toBe(35_100);
  });

  it('keeps deleted Projects and Trackers under their name', async () => {
    const user = await userIn('UTC');
    const { jar, token } = user;
    const kept = await createTracker(jar, token, 'Kept');
    const gone = await createTracker(jar, token, 'Gone');
    const oldSite = await createProject(jar, token, 'Site', kept.id);
    const orphan = await createProject(jar, token, 'Orphan', gone.id);
    const title = 'Work';
    await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T11:00:00Z', {
      title,
      projectId: oldSite.id,
    });
    await logTime(user, '2026-08-03T12:00:00Z', '2026-08-03T14:00:00Z', {
      title,
      projectId: orphan.id,
    });
    await remove(user, `/api/projects/${oldSite.id}`);
    await remove(user, `/api/trackers/${gone.id}`);
    const newSite = await createProject(jar, token, 'Site', kept.id);
    await logTime(user, '2026-08-03T15:00:00Z', '2026-08-03T16:00:00Z', {
      title,
      projectId: newSite.id,
    });

    const { groups } = await getDashboard(jar, '?date=2026-08-01');
    expect(groups.project.map(withoutBuckets)).toEqual([
      { kind: 'project', id: oldSite.id, name: 'Site', deleted: true, totalSeconds: 10_800 },
      { kind: 'project', id: orphan.id, name: 'Orphan', deleted: false, totalSeconds: 7200 },
      { kind: 'project', id: newSite.id, name: 'Site', deleted: false, totalSeconds: 3600 },
    ]);
    expect(groups.tracker.map(withoutBuckets)).toEqual([
      { kind: 'tracker', id: kept.id, name: 'Kept', deleted: false, totalSeconds: 14_400 },
      { kind: 'tracker', id: gone.id, name: 'Gone', deleted: true, totalSeconds: 7200 },
    ]);
  });

  it('splits each group per day of a week or month and per month of a year', async () => {
    const user = await userIn('Europe/Warsaw');
    const project = await createProject(user.jar, user.token, 'Books');
    const task = { title: 'Work', projectId: project.id };
    await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T09:00:00Z', task);
    await logTime(user, '2026-08-03T10:00:00Z', '2026-08-03T10:30:00Z', task);
    // Crosses local midnight, so it stays in August.
    await logTime(user, '2026-08-31T21:30:00Z', '2026-08-31T23:30:00Z', task);
    // 00:30 on September 1 in Warsaw.
    await logTime(user, '2026-08-31T22:30:00Z', '2026-08-31T22:45:00Z', task);

    const week = await getDashboard(user.jar, '?period=week&date=2026-08-31');
    expect(week.buckets).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
    const month = await getDashboard(user.jar, '?date=2026-08-31');
    expect(month.buckets).toHaveLength(31);
    const year = await getDashboard(user.jar, '?period=year&date=2026-08-31');
    expect(year.buckets).toHaveLength(12);
    expect(year.buckets.slice(0, 2)).toEqual(['2026-01-01', '2026-02-01']);
    for (const grouping of ['project', 'tracker'] as const) {
      expect(timeByBucket(week, week.groups[grouping][0])).toEqual({
        '2026-08-31': 7200,
        '2026-09-01': 900,
      });
      expect(timeByBucket(month, month.groups[grouping][0])).toEqual({
        '2026-08-03': 5400,
        '2026-08-31': 7200,
      });
      expect(timeByBucket(year, year.groups[grouping][0])).toEqual({
        '2026-08-01': 12_600,
        '2026-09-01': 900,
      });
    }
  });

  it('lists equal groups in creation order, time without a Project last', async () => {
    const user = await userIn('UTC');
    const title = 'Work';
    await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T09:00:00Z', { title });
    const first = await createProject(user.jar, user.token, 'Second by name');
    const second = await createProject(user.jar, user.token, 'First by name');
    for (const projectId of [second.id, first.id]) {
      await logTime(user, '2026-08-04T08:00:00Z', '2026-08-04T09:00:00Z', { title, projectId });
    }
    const { groups } = await getDashboard(user.jar, '?date=2026-08-01');
    expect(groups.project.map((group) => ('id' in group ? group.id : group.kind))).toEqual([
      first.id,
      second.id,
      'noProject',
    ]);
  });

  it('has no group for a Project whose only entry is shorter than a second', async () => {
    const user = await userIn('UTC');
    const project = await createProject(user.jar, user.token, 'Books');
    const task = { title: 'Work', projectId: project.id };
    await logTime(user, '2026-08-03T08:00:00.000Z', '2026-08-03T08:00:00.500Z', task);
    const { groups } = await getDashboard(user.jar, '?date=2026-08-01');
    expect(groups).toEqual({ project: [], tracker: [] });
  });

  it('colors the six largest Projects by creation order, deleted ones included', async () => {
    const user = await userIn('UTC');
    const ghost = await createProject(user.jar, user.token, 'Ghost');
    await remove(user, `/api/projects/${ghost.id}`);
    // Hours per Project in creation order; P1 is deleted after its time.
    const hours = { P0: 1, P1: 8, P2: 2, P3: 7, P4: 3, P5: 6, P6: 5, P7: 4 };
    const ids: string[] = [];
    for (const [index, [name, hour]] of Object.entries(hours).entries()) {
      const project = await createProject(user.jar, user.token, name);
      ids.push(project.id);
      const day = `2026-08-${String(index + 3).padStart(2, '0')}`;
      await logTime(user, `${day}T00:00:00Z`, `${day}T0${hour}:00:00Z`, {
        title: 'Work',
        projectId: project.id,
      });
      if (name === 'P1') await remove(user, `/api/projects/${project.id}`);
    }
    await logTime(user, '2026-08-20T00:00:00Z', '2026-08-20T10:00:00Z', { title: 'Work' });

    const { groups } = await getDashboard(user.jar, '?date=2026-08-01');
    // Places 1 to 8 after the deleted Ghost. P0 and P2 are the smallest; P7 wants the slot of P1
    // and takes the next free one.
    const slots = [null, 2, null, 4, 5, 0, 1, 3];
    expect(colorSlots(groups.project)).toEqual({
      noProject: null,
      ...Object.fromEntries(ids.map((id, index) => [id, slots[index]])),
    });
  });

  it('colors Local after every Tracker, deleted ones included', async () => {
    const user = await userIn('UTC');
    const { jar, token } = user;
    await createTracker(jar, token, 'First');
    const second = await createTracker(jar, token, 'Second');
    const gone = await createTracker(jar, token, 'Gone');
    await remove(user, `/api/trackers/${gone.id}`);
    const site = await createProject(jar, token, 'Site', second.id);
    const books = await createProject(jar, token, 'Books');
    await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T10:00:00Z', {
      title: 'Work',
      projectId: site.id,
    });
    await logTime(user, '2026-08-03T10:00:00Z', '2026-08-03T11:00:00Z', {
      title: 'Work',
      projectId: books.id,
    });

    const { groups } = await getDashboard(jar, '?date=2026-08-01');
    expect(colorSlots(groups.tracker)).toEqual({ [second.id]: 1, local: 3 });
  });

  it('lists one row per Task identity, merging its days and leaving untitled time out', async () => {
    const user = await userIn('UTC');
    const { jar, token } = user;
    const tracker = await createTracker(jar, token, 'Redmine');
    const site = await createProject(jar, token, 'Site', tracker.id);
    const shop = await createProject(jar, token, 'Shop', tracker.id);
    const review = { title: 'Review', projectId: site.id };
    await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T09:00:00Z', review);
    await logTime(user, '2026-08-04T08:00:00Z', '2026-08-04T10:00:00Z', review);
    const linked = await logTime(user, '2026-08-05T08:00:00Z', '2026-08-05T08:30:00Z', review);
    await linkIssue(user, linked, '42');
    await logTime(user, '2026-08-05T09:00:00Z', '2026-08-05T09:45:00Z', {
      title: 'Review',
      projectId: shop.id,
    });
    await logTime(user, '2026-08-06T08:00:00Z', '2026-08-06T10:30:00Z', { title: 'Admin' });
    // Untitled: no Task, so not listed, though it is the most time.
    await logTime(user, '2026-08-07T08:00:00Z', '2026-08-07T13:00:00Z', {});
    // Running, and outside the period.
    await logTime(user, '2026-07-31T08:00:00Z', '2026-07-31T18:00:00Z', review);
    expect((await startEntry(jar, token, { title: 'Running' })).status).toBe(200);

    const { topTasks } = await getDashboard(jar, '?date=2026-08-01');
    expect(topTasks.map(({ id: _id, ...task }) => task)).toEqual([
      {
        name: 'Review',
        project: { id: site.id, name: 'Site', deleted: false },
        remoteIssue: null,
        totalSeconds: 10_800,
      },
      { name: 'Admin', project: null, remoteIssue: null, totalSeconds: 9000 },
      {
        name: 'Review',
        project: { id: shop.id, name: 'Shop', deleted: false },
        remoteIssue: null,
        totalSeconds: 2700,
      },
      {
        name: 'Review',
        project: { id: site.id, name: 'Site', deleted: false },
        remoteIssue: {
          id: '42',
          title: 'Issue 42',
          url: 'https://redmine.example.com/work_packages/42',
        },
        totalSeconds: 1800,
      },
    ]);
    expect(new Set(topTasks.map((task) => task.id)).size).toBe(4);
  });

  it('lists the ten Tasks with the most time, equal ones in creation order', async () => {
    const user = await userIn('UTC');
    const minutes = [5, 30, 10, 45, 20, 50, 15, 40, 25, 35, 30, 55];
    for (const [index, minute] of minutes.entries()) {
      const day = `2026-08-${String(index + 3).padStart(2, '0')}`;
      await logTime(user, `${day}T08:00:00Z`, `${day}T08:${String(minute).padStart(2, '0')}:00Z`, {
        title: `Task ${index}`,
      });
    }
    const { topTasks } = await getDashboard(user.jar, '?date=2026-08-01');
    expect(topTasks.map((task) => [task.name, task.totalSeconds / 60])).toEqual([
      ['Task 11', 55],
      ['Task 5', 50],
      ['Task 3', 45],
      ['Task 7', 40],
      ['Task 9', 35],
      ['Task 1', 30],
      ['Task 10', 30],
      ['Task 8', 25],
      ['Task 4', 20],
      ['Task 6', 15],
    ]);
  });

  it('links a Remote issue only while its Tracker is active', async () => {
    const user = await userIn('UTC');
    const { jar, token } = user;
    const tracker = await createTracker(jar, token, 'Gone');
    const project = await createProject(jar, token, 'Site', tracker.id);
    const entry = await logTime(user, '2026-08-03T08:00:00Z', '2026-08-03T09:00:00Z', {
      title: 'Review',
      projectId: project.id,
    });
    await linkIssue(user, entry, '7');
    await remove(user, `/api/projects/${project.id}`);
    await remove(user, `/api/trackers/${tracker.id}`);

    const { topTasks } = await getDashboard(jar, '?date=2026-08-01');
    expect(topTasks).toMatchObject([
      {
        name: 'Review',
        project: { id: project.id, name: 'Site', deleted: true },
        remoteIssue: { id: '7', title: 'Issue 7', url: null },
      },
    ]);
  });

  /** A user for whom today holds during the test, with a Project of an active Tracker. */
  async function backlogUser() {
    const { timezone, offset, today } = zoneAwayFromMidnight();
    const user = await userIn(timezone);
    const tracker = await createTracker(user.jar, user.token, 'Redmine');
    const project = await createProject(user.jar, user.token, 'Site', tracker.id);
    const daysAgo = (days: number) => Temporal.PlainDate.from(today).subtract({ days }).toString();
    /** Logs an hour from 01:00 on the local day `days` before today. */
    const logDay = (
      days: number,
      task: { title?: string; projectId?: string } = { title: 'Work', projectId: project.id },
    ) => {
      const day = daysAgo(days);
      return logTime(user, `${day}T01:00:00${offset}`, `${day}T02:00:00${offset}`, task);
    };
    return { user, tracker, project, daysAgo, logDay };
  }

  it('lists the 30 days before today in the Export backlog, oldest first', async () => {
    const { user, daysAgo, logDay } = await backlogUser();
    for (const days of [1, 12, 30, 31, 0]) await logDay(days);
    const expected = [daysAgo(30), daysAgo(12), daysAgo(1)];
    expect((await getDashboard(user.jar)).exportBacklog).toEqual(expected);
    // The period does not change it.
    const past = await getDashboard(user.jar, '?period=week&date=2020-06-01');
    expect(past.exportBacklog).toEqual(expected);
  });

  it('keeps a day in the Export backlog until each of its Tasks is Sent', async () => {
    const { user, tracker, project, daysAgo, logDay } = await backlogUser();
    const day = daysAgo(5);
    const reviewEntry = await logDay(5, { title: 'Review', projectId: project.id });
    const review = await linkIssue(user, reviewEntry, '42');
    await linkIssue(user, await logDay(4, { title: 'Review', projectId: project.id }), '42');
    const deploy = await linkIssue(
      user,
      await logDay(5, { title: 'Deploy', projectId: project.id }),
      '43',
    );
    expect((await getDashboard(user.jar)).exportBacklog).toEqual([day, daysAgo(4)]);

    // Exported by the app: Review is Sent on that day only.
    await post(user, '/api/sync/export', {
      taskId: review,
      localDate: day,
      remoteIssueId: '42',
      remoteLogId: 'log-1',
      exportDurationSeconds: 3600,
      entryIds: [reviewEntry.id],
      exportRequestKey: `export-${review}`,
    });
    expect((await getDashboard(user.jar)).exportBacklog).toEqual([day, daysAgo(4)]);

    // Matched to a Remote log: Deploy is Sent too, which clears the day.
    await post(user, '/api/sync/link', {
      taskId: deploy,
      trackerId: tracker.id,
      localDate: day,
      remoteIssueId: '43',
      remoteLogId: 'log-2',
      exportDurationSeconds: 3600,
      spentOn: day,
    });
    expect((await getDashboard(user.jar)).exportBacklog).toEqual([daysAgo(4)]);

    // Imported: its Task's day arrives Sent.
    await post(user, `/api/trackers/${tracker.id}/import`, {
      dryRun: false,
      groups: [
        {
          projectId: project.id,
          logs: [
            {
              remoteLogId: 'log-3',
              remoteIssueId: '44',
              spentOn: daysAgo(3),
              durationSeconds: 5400,
              activityId: '1',
              comment: 'Imported work',
            },
          ],
        },
      ],
    });
    expect((await getDashboard(user.jar)).exportBacklog).toEqual([daysAgo(4)]);
  });

  it('leaves time it cannot export out of the Export backlog', async () => {
    const { user, project, daysAgo, logDay } = await backlogUser();
    const { jar, token } = user;
    const local = await createProject(jar, token, 'Books');
    await logDay(6, { title: 'Reading', projectId: local.id });
    await logDay(5, { title: 'Admin' });
    await logDay(4, {});
    const gone = await createTracker(jar, token, 'Gone');
    const orphan = await createProject(jar, token, 'Orphan', gone.id);
    await logDay(3, { title: 'Work', projectId: orphan.id });
    await remove(user, `/api/trackers/${gone.id}`);
    // Shorter than a second.
    const day = daysAgo(2);
    await logTime(user, `${day}T12:00:00.000Z`, `${day}T12:00:00.500Z`, {
      title: 'Work',
      projectId: project.id,
    });
    expect((await getDashboard(jar)).exportBacklog).toEqual([]);

    // A deleted Project's time can still be exported while its Tracker is active.
    const old = await createProject(
      jar,
      token,
      'Old',
      (await createTracker(jar, token, 'Kept')).id,
    );
    await logDay(1, { title: 'Work', projectId: old.id });
    await remove(user, `/api/projects/${old.id}`);
    expect((await getDashboard(jar)).exportBacklog).toEqual([daysAgo(1)]);
  });

  it('sums each day of the year up to and including today, whatever the period', async () => {
    const { timezone, offset, today } = zoneAwayFromMidnight();
    const user = await userIn(timezone);
    const day = (days: number) => Temporal.PlainDate.from(today).subtract({ days }).toString();
    const firstDay = Temporal.PlainDate.from(today).subtract({ years: 1 }).add({ days: 1 });
    const before = firstDay.subtract({ days: 1 }).toString();
    const at = (date: string, time: string) => `${date}T${time}${offset}`;
    await logTime(user, at(before, '10:00:00'), at(before, '11:00:00'));
    await logTime(user, at(firstDay.toString(), '10:00:00'), at(firstDay.toString(), '11:00:00'));
    await logTime(user, at(firstDay.toString(), '12:00:00'), at(firstDay.toString(), '12:30:00'));
    // Across midnight: wholly on the day it started.
    await logTime(user, at(day(3), '23:00:00'), at(day(2), '01:00:00'));
    await logTime(user, at(today, '00:30:00'), at(today, '01:00:00'));
    expect((await startEntry(user.jar, user.token, { title: 'Running' })).status).toBe(200);

    for (const query of ['', '?period=week&date=2020-06-01']) {
      const { pastYear } = await getDashboard(user.jar, query);
      expect(pastYear.firstDay).toBe(firstDay.toString());
      expect(pastYear.lastDay).toBe(today);
      expect(pastYear.daySeconds).toHaveLength(firstDay.until(today).days + 1);
      const days = pastYear.daySeconds.map((seconds, index) => [
        firstDay.add({ days: index }).toString(),
        seconds,
      ]);
      expect(Object.fromEntries(days.filter(([, seconds]) => seconds !== 0))).toEqual({
        [firstDay.toString()]: 5400,
        [day(3)]: 7200,
        [today]: 1800,
      });
    }
  });

  it("never shows another user's entries", async () => {
    const other = await backlogUser();
    await logTime(other.user, '2026-08-03T08:00:00.000Z', '2026-08-03T09:00:00.000Z');
    await other.logDay(1);
    const user = await userIn('UTC');
    const body = await getDashboard(user.jar, '?date=2026-08-03');
    expect(body.summary).toEqual(NO_TIME);
    expect(body.groups).toEqual({ project: [], tracker: [] });
    expect(body.topTasks).toEqual([]);
    expect(body.exportBacklog).toEqual([]);
    expect(body.pastYear.daySeconds.filter((seconds) => seconds !== 0)).toEqual([]);
    expect(body.hasEntries).toBe(false);
  });
});
