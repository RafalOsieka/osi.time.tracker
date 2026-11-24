import { Temporal } from 'temporal-polyfill';
import {
  DASHBOARD_EXPORT_BACKLOG_DAYS,
  type DashboardPeriodDto,
  type DashboardQuery,
} from '../../shared/types/dashboard';
import { localDayKey, localDayStartInstant } from './timer-view-feed';

const MONDAY = 1;
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

let firstDayByTimeZone: Map<string, number> | undefined;

/**
 * `Intl` lists a country's timezones but not a timezone's country, so the lookup is built once
 * from every two-letter region. Deprecated codes resolve to their current region and repeat it.
 */
function buildFirstDayByTimeZone(): Map<string, number> {
  const firstDays = new Map<string, number>();
  for (const first of LETTERS) {
    for (const second of LETTERS) {
      const locale = new Intl.Locale(`und-${first}${second}`);
      for (const timeZone of locale.getTimeZones() ?? []) {
        firstDays.set(timeZone, locale.getWeekInfo().firstDay);
      }
    }
  }
  return firstDays;
}

/**
 * ISO weekday (1 = Monday) that opens the week in the timezone's country; Monday for a timezone
 * without a country.
 */
export function firstDayOfWeekOf(timeZone: string): number {
  firstDayByTimeZone ??= buildFirstDayByTimeZone();
  return firstDayByTimeZone.get(timeZone) ?? MONDAY;
}

export interface ResolvedDashboardPeriod {
  today: string;
  period: DashboardPeriodDto;
}

/** The asked period, by default the month containing today in `timeZone`. */
export function resolveDashboardPeriod(
  query: DashboardQuery,
  now: Date,
  timeZone: string,
): ResolvedDashboardPeriod {
  const today = localDayKey(now.toISOString(), timeZone);
  const kind = query.period ?? 'month';
  const day = Temporal.PlainDate.from(query.date ?? today);

  let firstDay: Temporal.PlainDate;
  let lastDay: Temporal.PlainDate;
  switch (kind) {
    case 'week':
      firstDay = day.subtract({ days: (day.dayOfWeek - firstDayOfWeekOf(timeZone) + 7) % 7 });
      lastDay = firstDay.add({ days: 6 });
      break;
    case 'month':
      firstDay = day.with({ day: 1 });
      lastDay = day.with({ day: day.daysInMonth });
      break;
    case 'year':
      firstDay = day.with({ month: 1, day: 1 });
      lastDay = day.with({ month: 12, day: 31 });
      break;
  }
  return {
    today,
    period: { kind, firstDay: firstDay.toString(), lastDay: lastDay.toString() },
  };
}

/**
 * Inclusive start and exclusive end of the period. The end is the start of the following day, not
 * a day after the last day's start, which is off by an hour when clocks skip midnight.
 */
export function periodInstants(
  { firstDay, lastDay }: Pick<DashboardPeriodDto, 'firstDay' | 'lastDay'>,
  timeZone: string,
) {
  const dayAfter = Temporal.PlainDate.from(lastDay).add({ days: 1 }).toString();
  return {
    from: new Date(localDayStartInstant(firstDay, timeZone)),
    to: new Date(localDayStartInstant(dayAfter, timeZone)),
  };
}

/** The days the Export backlog covers: the ones before today, today left out. */
export function exportBacklogWindow(
  today: string,
): Pick<DashboardPeriodDto, 'firstDay' | 'lastDay'> {
  const day = Temporal.PlainDate.from(today);
  return {
    firstDay: day.subtract({ days: DASHBOARD_EXPORT_BACKLOG_DAYS }).toString(),
    lastDay: day.subtract({ days: 1 }).toString(),
  };
}

/** The bucket a day of the period falls in, named by its first day. */
export function bucketOf(day: string, { kind }: DashboardPeriodDto): string {
  return kind === 'year' ? `${day.slice(0, 7)}-01` : day;
}

/** Every bucket of the period, with time or without. */
export function periodBuckets(period: DashboardPeriodDto): string[] {
  const step = period.kind === 'year' ? { months: 1 } : { days: 1 };
  const buckets: string[] = [];
  let bucket = Temporal.PlainDate.from(period.firstDay);
  while (bucket.toString() <= period.lastDay) {
    buckets.push(bucket.toString());
    bucket = bucket.add(step);
  }
  return buckets;
}
