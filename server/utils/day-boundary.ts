import { Temporal } from 'temporal-polyfill';

/**
 * Computes the `[from, to)` instant window for a single calendar day in a
 * given timezone, mirroring the browser-local day-boundary rule the Timer
 * view uses (`app/utils/timerViewGrouping.ts`). Falls back to `UTC` when
 * the user has not configured a timezone.
 */
export function computeDayBoundary(
  date: string,
  timeZone: string | null,
): { from: Date; to: Date } {
  const zone = timeZone ?? 'UTC';
  const start = Temporal.PlainDate.from(date).toZonedDateTime(zone);
  const end = start.add({ days: 1 });
  return {
    from: new Date(start.toInstant().toString()),
    to: new Date(end.toInstant().toString()),
  };
}
