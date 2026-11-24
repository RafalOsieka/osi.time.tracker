import { Temporal } from 'temporal-polyfill';
import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import type { DashboardPastYearDto } from '../../shared/types/dashboard';
import type { getDb } from '../db/index';
import { timeEntries } from '../db/schema';
import { pastYearWindow, periodInstants } from './dashboard-period';
import { aggregateLocalDaySeconds } from './monthly-report';

type Db = ReturnType<typeof getDb>;

/** The user's time on each local day of the year up to and including `today`. */
export async function loadPastYear(
  db: Db,
  userId: string,
  timeZone: string,
  today: string,
): Promise<DashboardPastYearDto> {
  const window = pastYearWindow(today);
  const bounds = periodInstants(window, timeZone);
  const rows = await db
    .select({ startedAt: timeEntries.startedAt, stoppedAt: timeEntries.stoppedAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        isNotNull(timeEntries.stoppedAt),
        gte(timeEntries.startedAt, bounds.from),
        lt(timeEntries.startedAt, bounds.to),
      ),
    );

  const days = aggregateLocalDaySeconds(
    rows.map(({ startedAt, stoppedAt }) => ({
      startedAt: startedAt.toISOString(),
      stoppedAt: stoppedAt?.toISOString() ?? null,
    })),
    timeZone,
  );
  const secondsByDay = new Map(days.map((day) => [day.date, day.localSeconds]));
  const firstDay = Temporal.PlainDate.from(window.firstDay);
  const length = firstDay.until(window.lastDay).days + 1;
  return {
    ...window,
    daySeconds: Array.from(
      { length },
      (_, index) => secondsByDay.get(firstDay.add({ days: index }).toString()) ?? 0,
    ),
  };
}
