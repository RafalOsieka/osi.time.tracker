import { and, desc, eq, gte, lt } from 'drizzle-orm';
import {
  TIMER_VIEW_FEED_INITIAL_DAYS,
  TIMER_VIEW_FEED_LOAD_MORE_ACTIVITY_DAYS,
  timerViewFeedQuerySchema,
  type TimerViewFeedDto,
  type TimeEntryDto,
} from '../../../shared/types/time-entry';
import { getDb } from '../../db/index';
import { timeEntries, tasks, projects } from '../../db/schema';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';
import { getZodQuery } from '../../utils/zod-input';
import {
  feedNextBefore,
  feedTimeZone,
  localDayBounds,
  localDayKey,
  localDayStartInstant,
  oldestDayKeyAmong,
  rollingWindowBounds,
} from '../../utils/timer-view-feed';

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

/** Entries whose `startedAt` falls in `[from, to)` — uses `(userId, startedAt)` index. */
async function fetchEntriesInRange(userId: string, from: Date, to: Date): Promise<Row[]> {
  return getDb()
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
        lt(timeEntries.startedAt, to),
      ),
    )
    .orderBy(desc(timeEntries.startedAt));
}

async function fetchNewestStartedAt(userId: string): Promise<Date | null> {
  const [row] = await getDb()
    .select({ startedAt: timeEntries.startedAt })
    .from(timeEntries)
    .where(eq(timeEntries.userId, userId))
    .orderBy(desc(timeEntries.startedAt))
    .limit(1);
  return row?.startedAt ?? null;
}

async function existsStartedAtBefore(userId: string, before: Date): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), lt(timeEntries.startedAt, before)))
    .limit(1);
  return row != null;
}

/**
 * Walk backward `activityDays` activity days older than `before` using one indexed
 * `ORDER BY startedAt DESC LIMIT 1` per day (jump to that day's start each step).
 * Returns the exclusive-end-safe lower bound (start of the oldest day found).
 */
async function findLoadMoreRangeStart(
  userId: string,
  before: Date,
  timeZone: string,
  activityDays: number,
): Promise<Date | null> {
  let cursor = before;
  let oldestDayKey: string | null = null;

  for (let i = 0; i < activityDays; i++) {
    const [row] = await getDb()
      .select({ startedAt: timeEntries.startedAt })
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), lt(timeEntries.startedAt, cursor)))
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
  const parsedQuery = await getZodQuery(event, timerViewFeedQuerySchema);

  const timeZone = feedTimeZone(user.settings?.timezone);
  let rows: Row[] = [];

  if (parsedQuery.before) {
    const before = new Date(parsedQuery.before);
    const from = await findLoadMoreRangeStart(
      user.id,
      before,
      timeZone,
      TIMER_VIEW_FEED_LOAD_MORE_ACTIVITY_DAYS,
    );
    if (from) {
      rows = await fetchEntriesInRange(user.id, from, before);
    }
  } else {
    const window = rollingWindowBounds(TIMER_VIEW_FEED_INITIAL_DAYS, new Date(), timeZone);
    rows = await fetchEntriesInRange(user.id, new Date(window.from), new Date(window.to));

    if (rows.length === 0) {
      const newest = await fetchNewestStartedAt(user.id);
      if (newest) {
        const dayKey = localDayKey(newest.toISOString(), timeZone);
        const day = localDayBounds(dayKey, timeZone);
        rows = await fetchEntriesInRange(user.id, new Date(day.from), new Date(day.to));
      }
    }
  }

  const oldestDayKey = oldestDayKeyAmong(
    rows.map((row) => row.startedAt.toISOString()),
    timeZone,
  );
  const nextBefore = feedNextBefore(oldestDayKey, timeZone);
  const hasMore =
    nextBefore != null ? await existsStartedAtBefore(user.id, new Date(nextBefore)) : false;

  return {
    entries: await toDtos(user.id, rows),
    hasMore,
    nextBefore: hasMore ? nextBefore : null,
  };
});
