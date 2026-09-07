import { and, asc, eq, gte, isNotNull, isNull, lt, lte } from 'drizzle-orm';
import { monthlyReportQuerySchema, type MonthlyReportDto } from '../../../shared/types/report';
import { getDb } from '../../db/index';
import { remoteExports, timeEntries, trackers } from '../../db/schema';
import { getZodQuery } from '../../utils/zod-input';
import { monthDateRange, monthInstantRange } from '../../../shared/utils/report-month';
import { aggregateLocalDaySeconds, resolveReportMonth } from '../../utils/monthly-report';

export default defineEventHandler(async (event): Promise<MonthlyReportDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const parsedQuery = await getZodQuery(event, monthlyReportQuerySchema);
  const { month, timeZone } = resolveReportMonth(
    parsedQuery.month,
    new Date(),
    user.settings?.timezone,
  );
  const instants = monthInstantRange(month, timeZone);
  const dates = monthDateRange(month);

  const [entryRows, exportRows, trackerRows] = await Promise.all([
    db
      .select({
        startedAt: timeEntries.startedAt,
        stoppedAt: timeEntries.stoppedAt,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, user.id),
          isNotNull(timeEntries.stoppedAt),
          gte(timeEntries.startedAt, new Date(instants.from)),
          lt(timeEntries.startedAt, new Date(instants.to)),
        ),
      ),
    db
      .select({
        localDate: remoteExports.localDate,
        remoteLogId: remoteExports.remoteLogId,
        exportDurationSeconds: remoteExports.exportDurationSeconds,
      })
      .from(remoteExports)
      .where(
        and(
          eq(remoteExports.userId, user.id),
          gte(remoteExports.localDate, dates.from),
          lte(remoteExports.localDate, dates.to),
        ),
      ),
    db
      .select({
        id: trackers.id,
        name: trackers.name,
      })
      .from(trackers)
      .where(and(eq(trackers.userId, user.id), isNull(trackers.deletedAt)))
      .orderBy(asc(trackers.name)),
  ]);

  return {
    month,
    timezone: timeZone,
    trackers: trackerRows,
    days: aggregateLocalDaySeconds(
      entryRows.map((row) => ({
        startedAt: row.startedAt.toISOString(),
        stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
      })),
      timeZone,
    ),
    exports: exportRows.map((row) => ({
      localDate: String(row.localDate),
      remoteLogId: row.remoteLogId,
      exportDurationSeconds: row.exportDurationSeconds,
    })),
  };
});
