import { Temporal } from 'temporal-polyfill';

/**
 * Computes the `[from, to)` instant window for a single calendar day in a
 * given timezone, mirroring the browser-local day-boundary rule the Timer
 * view uses (`app/utils/timer-view-grouping.ts`). Every user has a stored
 * timezone (workspace-settings REQ-398).
 */
export type DayBoundary = { from: Date; to: Date };

export function computeDayBoundary(date: string, timeZone: string): DayBoundary {
  const start = Temporal.PlainDate.from(date).toZonedDateTime(timeZone);
  const end = start.add({ days: 1 });
  return {
    from: new Date(start.toInstant().toString()),
    to: new Date(end.toInstant().toString()),
  };
}
