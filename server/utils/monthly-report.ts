import { feedTimeZone, localDayKey } from './timer-view-feed';
import type { MonthlyReportDayDto } from '../../shared/types/report';
import { currentCalendarMonth } from '../../shared/utils/report-month';

export interface ResolvedReportMonth {
  month: string;
  timeZone: string;
}

export function resolveReportMonth(
  month: string | undefined,
  now: Date,
  storedTimezone: string | null | undefined,
): ResolvedReportMonth {
  const timeZone = feedTimeZone(storedTimezone);
  return { month: month ?? currentCalendarMonth(now, timeZone), timeZone };
}

export interface StoppedEntryInstants {
  startedAt: string;
  stoppedAt: string | null;
}

export function aggregateLocalDaySeconds(
  entries: readonly StoppedEntryInstants[],
  timeZone: string,
): MonthlyReportDayDto[] {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    if (entry.stoppedAt == null) continue;
    const startMs = new Date(entry.startedAt).getTime();
    const stopMs = new Date(entry.stoppedAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(stopMs)) continue;
    const seconds = Math.max(0, Math.floor((stopMs - startMs) / 1000));
    if (seconds === 0) continue;
    const date = localDayKey(entry.startedAt, timeZone);
    byDay.set(date, (byDay.get(date) ?? 0) + seconds);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, localSeconds]) => ({ date, localSeconds }));
}
