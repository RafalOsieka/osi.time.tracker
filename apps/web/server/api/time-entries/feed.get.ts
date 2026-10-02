import { and, desc, eq, gte, lt } from 'drizzle-orm';
import {
  TIMER_VIEW_FEED_PAGE_ACTIVITY_DAYS,
  timerViewFeedQuerySchema,
  type TimerViewFeedDto,
  type TimeEntryDto,
} from '../../../shared/types/time-entry';
import { getDb } from '../../db/index';
import { timeEntries, tasks, projects } from '../../db/schema';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';
import { getZodQuery } from '../../utils/zod-input';
import { localDayKey, localDayStartInstant, oldestDayKeyAmong } from '../../utils/timer-view-feed';

type Row = {
  id: string;
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
  startedAt: Date;
  stoppedAt: Date | null;
};

async function toDtos(userId: string, rows: Row[]): Promise<TimeEntryDto[]> {
  const taskIds = [...new Set(rows.map((row) => row.taskId).filter((id): id is string => !!id))];
  const refs = await getRemoteIssueRefsForTasks(userId, taskIds);
  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    taskName: row.taskName ?? null,
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    startedAt: row.startedAt.toISOString(),
    stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
    remoteIssueRef: row.taskId ? refs.get(row.taskId) : undefined,
  }));
}

/**
 * Entries whose `startedAt` falls in `[from, to)`, or `[from, ∞)` without `to` —
 * uses the `(userId, startedAt)` index.
 */
async function fetchEntriesInRange(userId: string, from: Date, to?: Date): Promise<Row[]> {
  const db = getDb();
  return db
    .select({
      id: timeEntries.id,
      taskId: timeEntries.taskId,
      taskName: tasks.name,
      projectId: tasks.projectId,
      projectName: projects.name,
      startedAt: timeEntries.startedAt,
      stoppedAt: timeEntries.stoppedAt,
    })
    .from(timeEntries)
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.startedAt, from),
        to ? lt(timeEntries.startedAt, to) : undefined,
      ),
    )
    .orderBy(desc(timeEntries.startedAt));
}

async function existsStartedAtBefore(userId: string, before: Date): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), lt(timeEntries.startedAt, before)))
    .limit(1);
  return row != null;
}

/**
 * Walk backward `activityDays` activity days older than `before` (or from the newest
 * entry when `before` is omitted) using one indexed
 * `ORDER BY startedAt DESC LIMIT 1` per day (jump to that day's start each step).
 * Returns the exclusive-end-safe lower bound (start of the oldest day found).
 */
async function findPageRangeStart(
  userId: string,
  before: Date | undefined,
  timeZone: string,
  activityDays: number,
): Promise<Date | null> {
  const db = getDb();
  let cursor = before;
  let oldestDayKey: string | null = null;

  for (let i = 0; i < activityDays; i++) {
    const [row] = await db
      .select({ startedAt: timeEntries.startedAt })
      .from(timeEntries)
      .where(
        and(eq(timeEntries.userId, userId), cursor ? lt(timeEntries.startedAt, cursor) : undefined),
      )
      .orderBy(desc(timeEntries.startedAt))
      .limit(1);

    if (!row) break;

    const day = localDayKey(row.startedAt.toISOString(), timeZone);
    oldestDayKey = day;
    // Skip the rest of this activity day; next lookup is strictly older.
    cursor = new Date(localDayStartInstant(day, timeZone));
  }

  return oldestDayKey ? new Date(localDayStartInstant(oldestDayKey, timeZone)) : null;
}

export default defineEventHandler(async (event): Promise<TimerViewFeedDto> => {
  const { user } = await requireAuth(event);
  const { before, from } = await getZodQuery(event, timerViewFeedQuerySchema);

  const timeZone = user.timezone;
  let rows: Row[] = [];

  if (from) {
    rows = await fetchEntriesInRange(user.id, new Date(from));
  } else {
    const upper = before ? new Date(before) : undefined;
    const pageStart = await findPageRangeStart(
      user.id,
      upper,
      timeZone,
      TIMER_VIEW_FEED_PAGE_ACTIVITY_DAYS,
    );
    if (pageStart) {
      rows = await fetchEntriesInRange(user.id, pageStart, upper);
    }
  }

  // Older history is anything before the oldest returned day; an empty range refresh
  // measures from the requested `from` day instead.
  const oldestDayKey =
    oldestDayKeyAmong(
      rows.map((row) => row.startedAt.toISOString()),
      timeZone,
    ) ?? (from ? localDayKey(from, timeZone) : null);
  const boundary = oldestDayKey ? localDayStartInstant(oldestDayKey, timeZone) : null;
  const hasMore = boundary ? await existsStartedAtBefore(user.id, new Date(boundary)) : false;

  return {
    entries: await toDtos(user.id, rows),
    hasMore,
    nextBefore: hasMore ? boundary : null,
  };
});
