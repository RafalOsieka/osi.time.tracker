import { Temporal } from 'temporal-polyfill';
import { and, eq, gt, isNotNull, lt } from 'drizzle-orm';
import {
  DASHBOARD_WEEKDAY_HOURS_WEEKS,
  type DashboardWeekdayHoursDto,
} from '../../shared/types/dashboard';
import type { getDb } from '../db/index';
import { timeEntries } from '../db/schema';
import { periodInstants, weekdayHoursWindow } from './dashboard-period';

type Db = ReturnType<typeof getDb>;

const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;

/** A completed Time entry's span. */
export interface TimeSpan {
  startedAt: Date;
  stoppedAt: Date;
}

/**
 * The time of the spans per ISO weekday (rows from Monday) and local hour, in milliseconds, each
 * span clipped to `from`-`to` and cut where the local hour changes: at each full hour and where
 * the clocks change. An hour the clocks repeat holds both of its runs; an hour they skip holds
 * nothing.
 */
export function localHourTotals(
  spans: readonly TimeSpan[],
  timeZone: string,
  { from, to }: { from: Date; to: Date },
): number[][] {
  const totals = Array.from({ length: DAYS_PER_WEEK }, () => Array<number>(HOURS_PER_DAY).fill(0));
  for (const span of spans) {
    const end = Math.min(span.stoppedAt.getTime(), to.getTime());
    let start = Math.max(span.startedAt.getTime(), from.getTime());
    while (start < end) {
      const local = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO(timeZone);
      const wall = local.toPlainDateTime();
      // Until the offset changes, the next hour on the clock is this far away.
      const toNextHour = wall
        .until(wall.round({ smallestUnit: 'hour', roundingMode: 'floor' }).add({ hours: 1 }))
        .total('milliseconds');
      const offsetChange = local.getTimeZoneTransition('next')?.epochMilliseconds ?? Infinity;
      const cut = Math.min(end, start + toNextHour, offsetChange);
      const hours = totals[local.dayOfWeek - 1];
      if (hours) hours[local.hour] = (hours[local.hour] ?? 0) + cut - start;
      start = cut;
    }
  }
  return totals;
}

/** The user's average time per weekday and local hour over the weeks before `today`. */
export async function loadWeekdayHours(
  db: Db,
  userId: string,
  timeZone: string,
  today: string,
): Promise<DashboardWeekdayHoursDto> {
  const window = weekdayHoursWindow(today);
  const bounds = periodInstants(window, timeZone);
  const rows = await db
    .select({ startedAt: timeEntries.startedAt, stoppedAt: timeEntries.stoppedAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        isNotNull(timeEntries.stoppedAt),
        lt(timeEntries.startedAt, bounds.to),
        gt(timeEntries.stoppedAt, bounds.from),
      ),
    );

  const spans = rows.flatMap(({ startedAt, stoppedAt }) =>
    stoppedAt ? [{ startedAt, stoppedAt }] : [],
  );
  const totals = localHourTotals(spans, timeZone, bounds);
  return {
    ...window,
    hourSeconds: totals.map((hours) =>
      hours.map((milliseconds) => Math.round(milliseconds / 1000 / DASHBOARD_WEEKDAY_HOURS_WEEKS)),
    ),
  };
}
