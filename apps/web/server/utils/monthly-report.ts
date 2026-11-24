import { localDayKey } from './timer-view-feed';
import type { MonthlyReportDayDto } from '../../shared/types/report';
import { currentCalendarMonth } from '../../shared/utils/report-month';

export interface ResolvedReportMonth {
  month: string;
  timeZone: string;
}

export function resolveReportMonth(
  month: string | undefined,
  now: Date,
  timeZone: string,
): ResolvedReportMonth {
  return { month: month ?? currentCalendarMonth(now, timeZone), timeZone };
}

export interface StoppedEntryInstants {
  startedAt: string;
  stoppedAt: string | null;
}

/** Whole seconds of a completed entry; 0 for a running or malformed one. */
export function completedSeconds({ startedAt, stoppedAt }: StoppedEntryInstants): number {
  if (stoppedAt == null) return 0;
  const startMs = new Date(startedAt).getTime();
  const stopMs = new Date(stoppedAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(stopMs)) return 0;
  return Math.max(0, Math.floor((stopMs - startMs) / 1000));
}

export function aggregateLocalDaySeconds(
  entries: readonly StoppedEntryInstants[],
  timeZone: string,
): MonthlyReportDayDto[] {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const seconds = completedSeconds(entry);
    if (seconds === 0) continue;
    const date = localDayKey(entry.startedAt, timeZone);
    byDay.set(date, (byDay.get(date) ?? 0) + seconds);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, localSeconds]) => ({ date, localSeconds }));
}
