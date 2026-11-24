import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import type { Db } from '../db/index';
import { projects, remoteExports, tasks, timeEntries, trackers } from '../db/schema';
import { exportBacklogWindow } from './dashboard-period';
import { completedEntriesStartedOn, withIsoInstants } from './dashboard-rows';
import { completedSeconds } from './monthly-report';
import { localDayKey } from './timer-view-feed';

/**
 * The days of the user's Export backlog before `today`, oldest first: the local days on which a
 * Task in a Project whose Tracker is active has Tracked time and no Export record.
 */
export async function loadExportBacklog(
  db: Db,
  userId: string,
  timeZone: string,
  today: string,
): Promise<string[]> {
  const backlogDays = exportBacklogWindow(today);
  const [entryRows, sent] = await Promise.all([
    db
      .select({
        taskId: tasks.id,
        startedAt: timeEntries.startedAt,
        stoppedAt: timeEntries.stoppedAt,
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(trackers, and(eq(trackers.id, projects.trackerId), isNull(trackers.deletedAt)))
      .where(completedEntriesStartedOn(userId, backlogDays, timeZone)),
    db
      .select({ taskId: remoteExports.taskId, localDate: remoteExports.localDate })
      .from(remoteExports)
      .where(
        and(
          eq(remoteExports.userId, userId),
          gte(remoteExports.localDate, backlogDays.firstDay),
          lte(remoteExports.localDate, backlogDays.lastDay),
        ),
      ),
  ]);

  const taskDayKey = (taskId: string | null, day: string) => `${taskId} ${day}`;
  const sentKeys = new Set(sent.map(({ taskId, localDate }) => taskDayKey(taskId, localDate)));

  const tracked = new Map<string, { day: string; seconds: number }>();
  for (const { taskId, ...instants } of entryRows.map(withIsoInstants)) {
    const day = localDayKey(instants.startedAt, timeZone);
    const key = taskDayKey(taskId, day);
    const taskDay = tracked.get(key) ?? { day, seconds: 0 };
    taskDay.seconds += completedSeconds(instants);
    tracked.set(key, taskDay);
  }

  const days = new Set<string>();
  for (const [key, { day, seconds }] of tracked) {
    if (seconds > 0 && !sentKeys.has(key)) days.add(day);
  }
  return [...days].sort();
}
