import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import { defineEventHandler } from 'nuxt/server';
import { dashboardQuerySchema, type DashboardDto } from '../../shared/types/dashboard';
import { getDb } from '../db/index';
import { projects, tasks, timeEntries, trackers } from '../db/schema';
import { aggregateProjectDays, groupProjectDays } from '../utils/dashboard-groups';
import {
  firstDayOfWeekOf,
  periodBuckets,
  periodInstants,
  resolveDashboardPeriod,
} from '../utils/dashboard-period';
import { getZodQuery } from '../utils/zod-input';

export default defineEventHandler(async (event): Promise<DashboardDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const query = await getZodQuery(event, dashboardQuerySchema);
  const { today, period } = resolveDashboardPeriod(query, new Date(), user.timezone);
  const bounds = periodInstants(period, user.timezone);
  const buckets = periodBuckets(period);

  const [entryRows, anyEntryRows] = await Promise.all([
    db
      .select({
        startedAt: timeEntries.startedAt,
        stoppedAt: timeEntries.stoppedAt,
        project: { id: projects.id, name: projects.name, deletedAt: projects.deletedAt },
        tracker: { id: trackers.id, name: trackers.name, deletedAt: trackers.deletedAt },
      })
      .from(timeEntries)
      .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(trackers, eq(trackers.id, projects.trackerId))
      .where(
        and(
          eq(timeEntries.userId, user.id),
          isNotNull(timeEntries.stoppedAt),
          gte(timeEntries.startedAt, bounds.from),
          lt(timeEntries.startedAt, bounds.to),
        ),
      ),
    db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(eq(timeEntries.userId, user.id))
      .limit(1),
  ]);

  const projectDays = aggregateProjectDays(
    entryRows.map((row) => ({
      ...row,
      startedAt: row.startedAt.toISOString(),
      stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
    })),
    user.timezone,
  );
  const days = projectDays.flatMap((project) => project.days);
  const totalSeconds = days.reduce((sum, day) => sum + day.localSeconds, 0);
  const daysWithEntries = new Set(days.map((day) => day.date)).size;

  return {
    period,
    today,
    timezone: user.timezone,
    firstDayOfWeek: firstDayOfWeekOf(user.timezone),
    hasEntries: anyEntryRows.length > 0,
    summary: {
      totalSeconds,
      daysWithEntries,
      averageSeconds: daysWithEntries === 0 ? 0 : Math.round(totalSeconds / daysWithEntries),
    },
    buckets,
    groups: {
      project: groupProjectDays(projectDays, 'project', period, buckets),
      tracker: groupProjectDays(projectDays, 'tracker', period, buckets),
    },
  };
});
