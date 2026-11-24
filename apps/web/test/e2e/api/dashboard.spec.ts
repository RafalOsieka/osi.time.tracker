import { expect, it } from 'vitest';
import type { DashboardDto } from '../../../shared/types/dashboard';
import { type CookieJar, patchTimezone } from '../helpers/auth';
import { startEntry } from '../helpers/http';
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

  async function logTime(user: SeededSession, startedAt: string, stoppedAt: string) {
    const res = await startEntry(user.jar, user.token, { title: 'Work', startedAt, stoppedAt });
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

  it("never shows another user's entries", async () => {
    const other = await userIn('UTC');
    await logTime(other, '2026-08-03T08:00:00.000Z', '2026-08-03T09:00:00.000Z');
    const user = await userIn('UTC');
    const body = await getDashboard(user.jar, '?date=2026-08-03');
    expect(body.summary).toEqual(NO_TIME);
    expect(body.hasEntries).toBe(false);
  });
});
