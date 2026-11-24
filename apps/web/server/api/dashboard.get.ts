import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import { defineEventHandler } from 'nuxt/server';
import { dashboardQuerySchema, type DashboardDto } from '../../shared/types/dashboard';
import { getDb } from '../db/index';
import { timeEntries } from '../db/schema';
import {
  firstDayOfWeekOf,
  periodInstants,
  resolveDashboardPeriod,
} from '../utils/dashboard-period';
import { aggregateLocalDaySeconds } from '../utils/monthly-report';
import { getZodQuery } from '../utils/zod-input';

export default defineEventHandler(async (event): Promise<DashboardDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const query = await getZodQuery(event, dashboardQuerySchema);
  const { today, period } = resolveDashboardPeriod(query, new Date(), user.timezone);
  const bounds = periodInstants(period, user.timezone);

  const [entryRows, anyEntryRows] = await Promise.all([
    db
      .select({ startedAt: timeEntries.startedAt, stoppedAt: timeEntries.stoppedAt })
      .from(timeEntries)
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

  const days = aggregateLocalDaySeconds(
    entryRows.map((row) => ({
      startedAt: row.startedAt.toISOString(),
      stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
    })),
    user.timezone,
  );
  const totalSeconds = days.reduce((sum, day) => sum + day.localSeconds, 0);

  return {
    period,
    today,
    timezone: user.timezone,
    firstDayOfWeek: firstDayOfWeekOf(user.timezone),
    hasEntries: anyEntryRows.length > 0,
    summary: {
      totalSeconds,
      daysWithEntries: days.length,
      averageSeconds: days.length === 0 ? 0 : Math.round(totalSeconds / days.length),
    },
  };
});
