import { Temporal } from 'temporal-polyfill';
import type { DashboardPastYearDto } from '../../shared/types/dashboard';
import type { Db } from '../db/index';
import { timeEntries } from '../db/schema';
import { pastYearWindow } from './dashboard-period';
import { completedEntriesStartedOn, withIsoInstants } from './dashboard-rows';
import { aggregateLocalDaySeconds } from './monthly-report';

/** The user's time on each local day of the year up to and including `today`. */
export async function loadPastYear(
  db: Db,
  userId: string,
  timeZone: string,
  today: string,
): Promise<DashboardPastYearDto> {
  const window = pastYearWindow(today);
  const rows = await db
    .select({ startedAt: timeEntries.startedAt, stoppedAt: timeEntries.stoppedAt })
    .from(timeEntries)
    .where(completedEntriesStartedOn(userId, window, timeZone));

  const days = aggregateLocalDaySeconds(rows.map(withIsoInstants), timeZone);
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
