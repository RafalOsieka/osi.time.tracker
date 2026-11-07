// The data behind the screenshot set: a fresh user with two Trackers (OpenProject and Redmine),
// four Projects and four days of Time entries, a running timer, and remote issues linked to most
// Tasks. Everything but the user goes through the app's API, as the browser would send it.
import { randomBytes } from 'node:crypto';
import { seedBootstrapUser } from '@osi/time-tracker-migrator';
import type { APIRequestContext } from 'playwright';
import postgres from 'postgres';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

export const TIME_ZONE = 'Europe/Warsaw';

export const TRACKERS = {
  acme: {
    name: 'Acme OpenProject',
    systemType: 'openproject',
    baseUrl: 'https://op.acme.example',
    roundingRule: 'up_15m',
  },
  globex: {
    name: 'Globex Redmine',
    systemType: 'redmine',
    baseUrl: 'https://redmine.globex.example',
    roundingRule: 'none',
  },
} as const;
type TrackerKey = keyof typeof TRACKERS;

const PROJECTS = {
  portal: { name: 'Acme Client Portal', tracker: 'acme' },
  mobile: { name: 'Acme Mobile App', tracker: 'acme' },
  billing: { name: 'Globex Billing', tracker: 'globex' },
  internal: { name: 'Internal', tracker: null },
} as const satisfies Record<string, { name: string; tracker: TrackerKey | null }>;
type ProjectKey = keyof typeof PROJECTS;

/** Each Task is an entry title in a Project; `issue` is the remote issue it is linked to. */
export const TASKS = {
  standup: {
    title: 'Daily standup',
    project: 'portal',
    issue: { id: '4101', title: 'Team meetings' },
  },
  invoices: {
    title: 'Invoice list: pagination and filters',
    project: 'portal',
    issue: { id: '4821', title: 'Client portal: invoice list' },
  },
  review: { title: 'Code review', project: 'internal', issue: null },
  push: {
    title: 'Push notifications on iOS',
    project: 'mobile',
    issue: { id: '5120', title: 'Mobile: push notifications' },
  },
  release: { title: 'Release 2.4 smoke test', project: 'mobile', issue: null },
  csv: {
    title: 'Billing export to CSV',
    project: 'billing',
    issue: { id: '112', title: 'CSV export of invoices' },
  },
} as const satisfies Record<
  string,
  { title: string; project: ProjectKey; issue: { id: string; title: string } | null }
>;
type TaskKey = keyof typeof TASKS;

/** One day's entries, local wall-clock times. A Task appearing twice makes a group of two. */
type DayPlan = readonly (readonly [TaskKey, start: string, end: string])[];

const BUSY_DAY: DayPlan = [
  ['standup', '08:30', '08:45'],
  ['invoices', '08:45', '10:30'],
  ['review', '10:45', '11:30'],
  ['invoices', '12:15', '14:00'],
  ['push', '14:00', '15:30'],
  ['csv', '15:45', '16:30'],
  ['release', '16:30', '17:00'],
];
const MOBILE_DAY: DayPlan = [
  ['standup', '09:00', '09:15'],
  ['push', '09:15', '11:45'],
  ['release', '12:30', '13:30'],
  ['push', '13:30', '14:45'],
  ['csv', '15:00', '16:15'],
];
/** Days back from today; today keeps only the entries that ended before the running timer. */
const DAYS: readonly DayPlan[] = [BUSY_DAY, BUSY_DAY, MOBILE_DAY, BUSY_DAY];

/** The running timer's Task and how long ago it started. */
const RUNNING = { task: 'invoices', minutesAgo: 47 } as const satisfies {
  task: TaskKey;
  minutesAgo: number;
};

/** The day the Remote sync screen opens: yesterday, a full `BUSY_DAY`. */
export function syncDay(): string {
  return Temporal.Now.plainDateISO(TIME_ZONE).subtract({ days: 1 }).toString();
}

export type ScreenshotUser = { email: string; password: string };

/** Inserts a fresh user the way the migrator seeds the bootstrap user, so no two runs share data. */
export async function createUser(databaseUrl: string): Promise<ScreenshotUser> {
  const user = {
    email: `screenshots-${randomBytes(4).toString('hex')}@example.com`,
    password: randomBytes(12).toString('base64url'),
    displayName: 'Ada Kowalska',
    timezone: TIME_ZONE,
  };
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await seedBootstrapUser(sql, user);
  } finally {
    await sql.end();
  }
  return user;
}

/** A JSON request body for the app's API. */
type RequestBody = Readonly<Record<string, string | boolean | null | readonly string[]>>;

/** What every create endpoint returns, as far as the seed needs it. */
const createdSchema = z.object({ id: z.string() });

/**
 * Seeds the user's data through the API of the signed-in `request` context; mutating calls carry
 * the page's CSRF token. Returns the Tracker ids, whose API secrets the browser must hold.
 */
export async function seedData(
  request: APIRequestContext,
  csrfToken: string,
): Promise<Record<TrackerKey, string>> {
  async function send(method: 'POST' | 'PATCH', path: string, data: RequestBody) {
    const res = await request.fetch(path, { method, data, headers: { 'csrf-token': csrfToken } });
    if (!res.ok()) {
      throw new Error(`${method} ${path} failed: HTTP ${res.status()} ${await res.text()}`);
    }
    return res;
  }
  /** POSTs `data` to a create endpoint and returns the new row's id. */
  async function create(path: string, data: RequestBody): Promise<string> {
    const res = await send('POST', path, data);
    return createdSchema.parse(await res.json()).id;
  }

  const trackers = { acme: '', globex: '' };
  // SAFETY: TRACKERS is a literal object, so its keys are exactly TrackerKey.
  for (const key of Object.keys(TRACKERS) as TrackerKey[]) {
    trackers[key] = await create('/api/trackers', { ...TRACKERS[key], directBrowserAccess: true });
  }

  const projects = { portal: '', mobile: '', billing: '', internal: '' };
  // SAFETY: PROJECTS is a literal object, so its keys are exactly ProjectKey.
  for (const key of Object.keys(PROJECTS) as ProjectKey[]) {
    const { name, tracker } = PROJECTS[key];
    projects[key] = await create('/api/projects', {
      name,
      trackerId: tracker ? trackers[tracker] : null,
    });
  }

  const now = Temporal.Now.zonedDateTimeISO(TIME_ZONE);
  const runningStart = now.subtract({ minutes: RUNNING.minutesAgo });
  const entriesByTask = new Map<TaskKey, string[]>();
  for (const [daysAgo, plan] of DAYS.entries()) {
    const date = now.toPlainDate().subtract({ days: daysAgo });
    for (const [task, start, end] of plan) {
      const startedAt = date.toZonedDateTime({ timeZone: TIME_ZONE, plainTime: start });
      const stoppedAt = date.toZonedDateTime({ timeZone: TIME_ZONE, plainTime: end });
      if (Temporal.ZonedDateTime.compare(stoppedAt, runningStart) > 0) continue;
      const { title, project } = TASKS[task];
      const id = await create('/api/time-entries', {
        title,
        projectId: projects[project],
        startedAt: startedAt.toInstant().toString(),
        stoppedAt: stoppedAt.toInstant().toString(),
      });
      entriesByTask.set(task, [...(entriesByTask.get(task) ?? []), id]);
    }
  }

  for (const [task, ids] of entriesByTask) {
    const { issue } = TASKS[task];
    if (!issue) continue;
    await send('POST', '/api/time-entries/reassign', {
      ids,
      remoteIssueId: issue.id,
      cachedTitle: issue.title,
    });
  }

  // Started last, so it is the one running; then moved back to look like a timer mid-task.
  const { title, project } = TASKS[RUNNING.task];
  const running = await create('/api/time-entries', { title, projectId: projects[project] });
  await send('PATCH', `/api/time-entries/${running}`, {
    startedAt: runningStart.toInstant().toString(),
  });

  return trackers;
}
